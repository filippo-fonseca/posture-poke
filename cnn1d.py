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
