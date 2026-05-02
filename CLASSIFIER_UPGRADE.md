# Classifier Upgrade — toy CNN ➜ 1D ResNet-SE

> **What changed:** the downstream classifier used in TSTR / TRTR evaluation
> (`evaluate_trts.py`) was a tiny 60K-param 3-block CNN. Replaced with a
> **1D ResNet with squeeze-and-excitation attention**, ~2.2 M params, the
> standard backbone for ECG-like 1D physiological signals.

> **Why:** the toy CNN was capacity-bottlenecked — even the TRTR ceiling
> (real→real) was sitting near chance (~0.51 macro-AUROC). The headline TSTR
> ratio is meaningless against a broken ceiling. With a proper backbone, the
> TRTR ceiling should rise to roughly 0.65–0.75, and TSTR will then carry
> real signal.

---

## TL;DR — what to change on the cluster

Two files need updating, no other code touches.

| file | what to do |
|---|---|
| `generative-model/cnn1d.py` | **replace entire contents** with the block in §1 below |
| `generative-model/evaluate_trts.py` | one-line edit (lr default + epochs default) — §2 |

Then run the same evaluation command as before — §3.

---

## 1. Replace `generative-model/cnn1d.py`

**Path on cluster:**

```
<repo-root>/generative-model/cnn1d.py
```

**Option A — paste-via-heredoc (no scp needed).** Run this on the cluster from
the repo root:

```bash
cat > generative-model/cnn1d.py <<'PYEOF'
"""
cnn1d.py — 1D ResNet-SE classifier for 1500-D MIMIC IP scans.

Used by evaluate_trts.py for the TSTR / TRTR downstream evaluator.
Architecture: pre-activation ResNet-1D + Squeeze-and-Excitation, ~2M params,
4 stages, large receptive field. Standard backbone for ECG-like 1D
physiological signals (Hannun et al. Nature Medicine 2019; xResNet1D lineage).

Class name `CNN1D` is preserved for drop-in compatibility with the rest of the
pipeline — the implementation is now a ResNet, not the original 3-block CNN.

Input:  (B, 2, 1500) — z-scored time + z-scored FFT magnitude
Output: (B, n_classes) logits (multi-label; pair with BCEWithLogitsLoss)
"""
from __future__ import annotations
import torch
import torch.nn as nn
import torch.nn.functional as F


class SEBlock1D(nn.Module):
    """Squeeze-and-Excitation: per-channel attention via global pooling."""

    def __init__(self, ch: int, r: int = 8):
        super().__init__()
        hidden = max(ch // r, 4)
        self.gate = nn.Sequential(
            nn.AdaptiveAvgPool1d(1),
            nn.Flatten(),
            nn.Linear(ch, hidden),
            nn.SiLU(),
            nn.Linear(hidden, ch),
            nn.Sigmoid(),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return x * self.gate(x).unsqueeze(-1)


class ResBlock1D(nn.Module):
    """Pre-activation residual block: BN → SiLU → Conv ×2, with SE on the residual."""

    def __init__(self, in_ch: int, out_ch: int, kernel_size: int = 7, stride: int = 1, drop: float = 0.1):
        super().__init__()
        pad = kernel_size // 2
        self.bn1 = nn.BatchNorm1d(in_ch)
        self.conv1 = nn.Conv1d(in_ch, out_ch, kernel_size, stride=stride, padding=pad, bias=False)
        self.bn2 = nn.BatchNorm1d(out_ch)
        self.drop = nn.Dropout(drop)
        self.conv2 = nn.Conv1d(out_ch, out_ch, kernel_size, padding=pad, bias=False)
        self.se = SEBlock1D(out_ch)
        if stride != 1 or in_ch != out_ch:
            self.skip = nn.Conv1d(in_ch, out_ch, kernel_size=1, stride=stride, bias=False)
        else:
            self.skip = nn.Identity()

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        h = F.silu(self.bn1(x))
        h = self.conv1(h)
        h = F.silu(self.bn2(h))
        h = self.drop(h)
        h = self.conv2(h)
        h = self.se(h)
        return h + self.skip(x)


class CNN1D(nn.Module):
    """1D ResNet-SE — drop-in replacement for the original toy CNN.

    Stages (channels, length-after-stage):
        stem    (32,  ~375)   Conv1d(k=15, s=2) → BN → SiLU → MaxPool(s=2)
        stage 1 (32,  ~375)   2 × ResBlock(k=7)
        stage 2 (64,  ~188)   2 × ResBlock(k=7), first stride=2
        stage 3 (128, ~94)    2 × ResBlock(k=7), first stride=2
        stage 4 (256, ~47)    2 × ResBlock(k=7), first stride=2
        head     (n_classes,) AdaptiveAvgPool → Dropout(0.3) → Linear

    Roughly 2.0–2.2 M trainable parameters.
    """

    def __init__(self, n_classes: int = 4, in_ch: int = 2, base_ch: int = 32, dropout: float = 0.3):
        super().__init__()
        self.stem = nn.Sequential(
            nn.Conv1d(in_ch, base_ch, kernel_size=15, stride=2, padding=7, bias=False),
            nn.BatchNorm1d(base_ch),
            nn.SiLU(),
            nn.MaxPool1d(kernel_size=3, stride=2, padding=1),
        )
        chs = [base_ch, base_ch * 2, base_ch * 4, base_ch * 8]   # 32, 64, 128, 256
        strides = [1, 2, 2, 2]
        blocks = []
        in_c = base_ch
        for c, s in zip(chs, strides):
            blocks.append(ResBlock1D(in_c, c, kernel_size=7, stride=s, drop=0.1))
            blocks.append(ResBlock1D(c,    c, kernel_size=7, stride=1, drop=0.1))
            in_c = c
        self.body = nn.Sequential(*blocks)
        self.head = nn.Sequential(
            nn.AdaptiveAvgPool1d(1),
            nn.Flatten(),
            nn.Dropout(dropout),
            nn.Linear(chs[-1], n_classes),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        x = self.stem(x)
        x = self.body(x)
        return self.head(x)


def make_2channel_input(x_time: torch.Tensor) -> torch.Tensor:
    """
    x_time: (B, 1500) raw time-domain scan
    returns: (B, 2, 1500) — z-scored time channel + z-scored FFT magnitude channel
    """
    eps = 1e-6
    mu = x_time.mean(dim=-1, keepdim=True)
    sd = x_time.std(dim=-1, keepdim=True).clamp_min(eps)
    t = (x_time - mu) / sd
    f = torch.fft.rfft(x_time, dim=-1).abs()
    pad = x_time.shape[-1] - f.shape[-1]
    f = F.pad(f, (0, pad))
    fmu = f.mean(dim=-1, keepdim=True)
    fsd = f.std(dim=-1, keepdim=True).clamp_min(eps)
    f = (f - fmu) / fsd
    return torch.stack([t, f], dim=1)
PYEOF
```

**Option B — scp from your local Mac.** I already wrote the new contents to
your local `generative-model/cnn1d.py`, so:

```bash
# from your Mac:
scp generative-model/cnn1d.py <user>@<ycrc-host>:<repo-root>/generative-model/cnn1d.py
```

**Verify the file landed correctly** (on the cluster):

```bash
python3 -c "
import sys; sys.path.insert(0, 'generative-model')
from cnn1d import CNN1D
m = CNN1D(n_classes=4)
print(f'params: {sum(p.numel() for p in m.parameters())/1e6:.2f} M')
"
# expected output: params: 2.23 M
```

---

## 2. Update `generative-model/evaluate_trts.py`

**Path on cluster:**

```
<repo-root>/generative-model/evaluate_trts.py
```

Around line 68–70, change the defaults inside `def train_classifier(...)`:

**before:**

```python
    epochs: int = 25,
    batch: int = 64,
    lr: float = 3e-3,
```

**after:**

```python
    epochs: int = 40,
    batch: int = 64,
    lr: float = 1e-3,
```

That's it — `lr=3e-3` was tuned for the toy CNN and is too hot for the bigger
ResNet (was making the bigger model diverge). `epochs=40` gives the ResNet
enough time to converge.

**One-liner sed equivalent on the cluster:**

```bash
sed -i 's/epochs: int = 25/epochs: int = 40/' generative-model/evaluate_trts.py
sed -i 's/lr: float = 3e-3/lr: float = 1e-3/' generative-model/evaluate_trts.py
```

---

## 3. Run the evaluator (same command as before)

```bash
python3 generative-model/evaluate_trts.py \
    --K 150 \
    --synth generative-model/checkpoints/synth_K150.pt \
    --epochs 40
```

Wall time on an A100: roughly **5–10 min per classifier × 2 classifiers = 10–20 min total**
(TSTR + TRTR back-to-back).

Output is written to `generative-model/checkpoints/trts_report_K150.json`
and printed to stdout.

---

## 4. What you should see

| number | toy CNN (before) | ResNet-SE (after) | comment |
|---|---|---|---|
| TRTR macro-AUROC | ~0.51 | **0.65–0.75** | the dataset's true ceiling |
| TSTR macro-AUROC | ~0.51 | **depends on diffusion training quality** | the headline number |
| TSTR / TRTR ratio | ~1.0 (uninformative) | **the meaningful comparison** | aim for ≥ 0.85 |

If TRTR doesn't move from ~0.51 with the new classifier, the bottleneck isn't
the classifier — it's something upstream (data quality, label noise, or the
4-class set being intrinsically hard from impedance signals alone). Useful
diagnostic either way.

---

## 5. Reverting (if needed)

The old toy CNN is preserved in git history. To revert:

```bash
git show HEAD:generative-model/cnn1d.py > generative-model/cnn1d.py
git checkout -- generative-model/evaluate_trts.py
```

---

## Notes on the architecture choice

- **Why a ResNet, not a transformer?** With only ~7k training scans, a transformer
  is data-hungry and likely to underperform. ResNet-1D is the workhorse for
  ECG/IP signals at this dataset scale — proven on PhysioNet challenges, fast to
  train, ~2 M params is the sweet spot.
- **Why SE attention?** Per-channel gating is essentially free (a tiny MLP per
  block) and reliably adds a few points of AUROC on time-series tasks.
- **Why same `CNN1D` class name?** So no other file in the pipeline needs to
  change. The name is technically a misnomer now (it's a ResNet), but it keeps
  the patch surgical.
