"""Minimal async client for the MySmartFilter public API."""
from __future__ import annotations

import aiohttp

from .const import API_BASE


class MySmartFilterAuthError(Exception):
    """Raised when the API key is rejected."""


class MySmartFilterApiError(Exception):
    """Raised on any other API failure."""


class MySmartFilterClient:
    """Thin wrapper over GET /api/v1/devices."""

    def __init__(self, session: aiohttp.ClientSession, api_key: str) -> None:
        self._session = session
        self._api_key = api_key

    async def async_get_devices(self) -> list[dict]:
        """Fetch all devices with filter-health fields."""
        try:
            resp = await self._session.get(
                f"{API_BASE}/devices",
                headers={"Authorization": f"Bearer {self._api_key}"},
                timeout=aiohttp.ClientTimeout(total=20),
            )
        except aiohttp.ClientError as err:
            raise MySmartFilterApiError(f"Connection error: {err}") from err

        if resp.status == 401:
            raise MySmartFilterAuthError("Invalid API key")
        if resp.status != 200:
            raise MySmartFilterApiError(f"API returned HTTP {resp.status}")

        payload = await resp.json()
        return payload.get("data", [])
