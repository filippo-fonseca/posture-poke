import asyncio
from bleak import BleakScanner

async def scan():
    print("Scanning for ALL BLE devices (10 seconds)...")
    devices = await BleakScanner.discover(timeout=10.0)
    
    print(f"\nFound {len(devices)} devices:\n")
    for d in devices:
        name = d.name or "(no name)"
        print(f"  {name:30s}  {d.address}")
    
    print("\n--- Looking for PostureDetector specifically ---")
    found = [d for d in devices if d.name and "posture" in d.name.lower()]
    if found:
        print(f"  ✅ Found it: {found[0].name} ({found[0].address})")
    else:
        print("  ❌ Not found in scan results")

asyncio.run(scan())
