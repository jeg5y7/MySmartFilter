"""MySmartFilter — HVAC filter monitor integration."""
from __future__ import annotations

from datetime import timedelta
import logging

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import CONF_API_KEY, Platform
from homeassistant.core import HomeAssistant
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed

from .api import MySmartFilterApiError, MySmartFilterAuthError, MySmartFilterClient
from .const import DOMAIN, UPDATE_INTERVAL_SECONDS

_LOGGER = logging.getLogger(__name__)

PLATFORMS: list[Platform] = [Platform.SENSOR, Platform.BINARY_SENSOR]


class MySmartFilterCoordinator(DataUpdateCoordinator[dict[str, dict]]):
    """Polls the cloud API and exposes devices keyed by device id."""

    def __init__(self, hass: HomeAssistant, client: MySmartFilterClient) -> None:
        super().__init__(
            hass,
            _LOGGER,
            name=DOMAIN,
            update_interval=timedelta(seconds=UPDATE_INTERVAL_SECONDS),
        )
        self.client = client

    async def _async_update_data(self) -> dict[str, dict]:
        try:
            devices = await self.client.async_get_devices()
        except MySmartFilterAuthError as err:
            raise UpdateFailed(f"Authentication failed: {err}") from err
        except MySmartFilterApiError as err:
            raise UpdateFailed(str(err)) from err
        return {d["id"]: d for d in devices}


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up MySmartFilter from a config entry."""
    client = MySmartFilterClient(
        async_get_clientsession(hass), entry.data[CONF_API_KEY]
    )
    coordinator = MySmartFilterCoordinator(hass, client)
    await coordinator.async_config_entry_first_refresh()

    hass.data.setdefault(DOMAIN, {})[entry.entry_id] = coordinator
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unload_ok:
        hass.data[DOMAIN].pop(entry.entry_id)
    return unload_ok
