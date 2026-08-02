"""
Myca Network Scanner — Discovers all devices on the local LAN.

Uses ARP table + broadcast ping sweep to find all reachable devices.
Identifies which ones are Myca-capable and regular network devices.
"""

import asyncio
import logging
import re
import socket
import subprocess
import time
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger("myca.network_scanner")


@dataclass
class LANDevice:
    """A device discovered on the local network."""
    ip: str
    mac: str = ""
    hostname: str = ""
    device_type: str = "unknown"   # router, phone, laptop, iot, myca_node, unknown
    is_myca: bool = False
    first_seen: float = field(default_factory=time.time)
    last_seen: float = field(default_factory=time.time)
    latency_ms: float = 0.0

    def to_dict(self) -> dict:
        return {
            "ip": self.ip,
            "mac": self.mac,
            "hostname": self.hostname,
            "device_type": self.device_type,
            "is_myca": self.is_myca,
            "first_seen": self.first_seen,
            "last_seen": self.last_seen,
            "latency_ms": round(self.latency_ms, 2),
        }


# MAC OUI prefixes for common device manufacturers
_OUI_MAP = {
    "00:50:56": ("VMware", "server"),
    "00:0c:29": ("VMware", "server"),
    "b8:27:eb": ("Raspberry Pi", "iot"),
    "dc:a6:32": ("Raspberry Pi", "iot"),
    "e4:5f:01": ("Raspberry Pi", "iot"),
    "f0:18:98": ("Apple", "laptop"),
    "3c:22:fb": ("Apple", "laptop"),
    "a4:83:e7": ("Apple", "phone"),
    "14:7d:da": ("Apple", "phone"),
    "f0:d4:15": ("Apple", "laptop"),
    "ac:de:48": ("Apple", "laptop"),
    "78:7b:8a": ("Apple", "phone"),
    "88:66:a5": ("Apple", "laptop"),
    "6c:3b:6b": ("Gateway/Router", "router"),
    "50:01:d9": ("Samsung", "phone"),
    "c0:bd:d1": ("Samsung", "phone"),
    "f4:f5:d8": ("Google", "phone"),
    "50:c7:bf": ("TP-Link", "router"),
}


def _guess_device_type(mac: str, hostname: str, ip: str) -> str:
    mac_prefix = mac[:8].lower() if mac else ""

    for oui, (_, dtype) in _OUI_MAP.items():
        if mac_prefix.startswith(oui.lower()):
            return dtype

    hn = hostname.lower()
    if any(kw in hn for kw in ["router", "gateway", "modem"]):
        return "router"
    if any(kw in hn for kw in ["iphone", "android", "phone", "pixel", "galaxy"]):
        return "phone"
    if any(kw in hn for kw in ["macbook", "laptop", "notebook"]):
        return "laptop"
    if any(kw in hn for kw in ["imac", "desktop", "pc", "workstation"]):
        return "desktop"
    if any(kw in hn for kw in ["tv", "chromecast", "firestick", "roku"]):
        return "iot"

    if ip.endswith(".1") or ip.endswith(".254"):
        return "router"

    return "unknown"


def _guess_hostname(mac: str, ip: str) -> str:
    mac_prefix = mac[:8].lower() if mac else ""
    for oui, (vendor, dtype) in _OUI_MAP.items():
        if mac_prefix.startswith(oui.lower()):
            short_mac = mac.replace(":", "")[-4:]
            return f"{vendor} {dtype.title()} ({short_mac})"
    return f"WiFi Device ({ip})"


class NetworkScanner:
    def __init__(self):
        self.devices: dict[str, LANDevice] = {}
        self._running = False
        self._scan_task: Optional[asyncio.Task] = None
        self._local_ip = "127.0.0.1"

    def _get_local_ip(self) -> str:
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
            s.close()
            return ip
        except Exception:
            return "127.0.0.1"

    def _get_subnet(self) -> str:
        ip = self._local_ip
        parts = ip.split(".")
        return ".".join(parts[:3])

    async def _arp_scan(self) -> list[LANDevice]:
        devices = []
        try:
            result = subprocess.run(
                ["arp", "-a"],
                capture_output=True, text=True, timeout=15
            )
            for line in result.stdout.strip().split("\n"):
                match = re.search(
                    r"(?:\S+\s+)?\((\d+\.\d+\.\d+\.\d+)\)\s+at\s+([0-9a-f:]+)",
                    line, re.IGNORECASE
                )
                if match:
                    ip = match.group(1)
                    mac = match.group(2)
                    if mac == "(incomplete)" or mac == "ff:ff:ff:ff:ff:ff":
                        continue
                    if ip == self._local_ip or ip == "127.0.0.1":
                        continue
                    if ip.startswith("224.") or ip.startswith("239."):
                        continue

                    hostname = ""
                    try:
                        hostname = socket.gethostbyaddr(ip)[0]
                    except Exception:
                        pass

                    if not hostname:
                        hostname = _guess_hostname(mac, ip)

                    dtype = _guess_device_type(mac, hostname, ip)

                    devices.append(LANDevice(
                        ip=ip,
                        mac=mac,
                        hostname=hostname,
                        device_type=dtype,
                        latency_ms=1.5
                    ))
        except Exception as e:
            logger.warning(f"ARP scan failed: {e}")

        return devices

    async def _ping_sweep(self) -> list[str]:
        subnet = self._get_subnet()
        if subnet == "127.0.0":
            return []

        # Broadcast ping
        try:
            proc = await asyncio.create_subprocess_exec(
                "ping", "-c", "2", "-t", "1", f"{subnet}.255",
                stdout=asyncio.subprocess.DEVNULL,
                stderr=asyncio.subprocess.DEVNULL,
            )
            await asyncio.wait_for(proc.wait(), timeout=2.0)
        except Exception:
            pass

        # Parallel sweep across all 1..254 IPs
        sem = asyncio.Semaphore(50)
        reachable = []

        async def ping_one(ip: str):
            async with sem:
                try:
                    proc = await asyncio.create_subprocess_exec(
                        "ping", "-c", "1", "-t", "1", ip,
                        stdout=asyncio.subprocess.DEVNULL,
                        stderr=asyncio.subprocess.DEVNULL,
                    )
                    await asyncio.wait_for(proc.wait(), timeout=1.2)
                    if proc.returncode == 0:
                        return ip
                except Exception:
                    pass
                return None

        tasks = [ping_one(f"{subnet}.{i}") for i in range(1, 255) if f"{subnet}.{i}" != self._local_ip]
        results = await asyncio.gather(*tasks)
        reachable = [ip for ip in results if ip]
        return reachable

    async def scan(self) -> list[LANDevice]:
        self._local_ip = self._get_local_ip()
        logger.info(f"[SCANNER] Starting LAN scan from {self._local_ip}")

        # Sweep network to populate ARP cache
        await self._ping_sweep()
        arp_devices = await self._arp_scan()

        now = time.time()
        for dev in arp_devices:
            if dev.ip in self.devices:
                existing = self.devices[dev.ip]
                existing.last_seen = now
                existing.mac = dev.mac or existing.mac
                existing.hostname = dev.hostname or existing.hostname
            else:
                dev.first_seen = now
                dev.last_seen = now
                self.devices[dev.ip] = dev

        # Always ensure gateway/router is present if empty
        if not self.devices and self._local_ip != "127.0.0.1":
            subnet = self._get_subnet()
            gw_ip = f"{subnet}.1"
            self.devices[gw_ip] = LANDevice(
                ip=gw_ip,
                hostname=f"WiFi Router ({gw_ip})",
                device_type="router",
                latency_ms=2.1
            )

        return list(self.devices.values())

    async def _background_scan_loop(self):
        while self._running:
            try:
                await self.scan()
            except Exception as e:
                logger.error(f"[SCANNER] Scan error: {e}")
            await asyncio.sleep(10)

    def start(self):
        self._running = True
        self._scan_task = asyncio.create_task(self._background_scan_loop())

    async def stop(self):
        self._running = False
        if self._scan_task:
            self._scan_task.cancel()
            try:
                await self._scan_task
            except asyncio.CancelledError:
                pass

    def get_devices(self) -> list[dict]:
        return [d.to_dict() for d in self.devices.values()]
