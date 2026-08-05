"""Binary sensors: filter-replacement needed, monitor connectivity."""
from __future__ import annotations

from homeassistant.components.binary_sensor import (
    BinarySensorDeviceClass,
    BinarySensorEntity,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from . import MySmartFilterCoordinator
from .const import DOMAIN
from .entity import MySmartFilterEntity


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    coordinator: MySmartFilterCoordinator = hass.data[DOMAIN][entry.entry_id]
    entities: list[BinarySensorEntity] = []
    for device_id in coordinator.data:
        entities.append(ReplaceFilterSensor(coordinator, device_id))
        entities.append(MonitorOnlineSensor(coordinator, device_id))
    async_add_entities(entities)


class ReplaceFilterSensor(MySmartFilterEntity, BinarySensorEntity):
    """On when the energy model says a new filter is cheaper than the old one."""

    _attr_device_class = BinarySensorDeviceClass.PROBLEM
    _attr_translation_key = "replace_filter"

    def __init__(self, coordinator: MySmartFilterCoordinator, device_id: str) -> None:
        super().__init__(coordinator, device_id)
        self._attr_unique_id = f"{device_id}_replace_filter"

    @property
    def is_on(self) -> bool:
        return self.device.get("filterStatus") == "replace_now"

    @property
    def extra_state_attributes(self) -> dict:
        return {"filter_status": self.device.get("filterStatus")}


class MonitorOnlineSensor(MySmartFilterEntity, BinarySensorEntity):
    """On while the monitor is checking in on schedule."""

    _attr_device_class = BinarySensorDeviceClass.CONNECTIVITY
    _attr_translation_key = "monitor_online"
    _attr_entity_registry_enabled_default = False

    def __init__(self, coordinator: MySmartFilterCoordinator, device_id: str) -> None:
        super().__init__(coordinator, device_id)
        self._attr_unique_id = f"{device_id}_online"

    @property
    def is_on(self) -> bool:
        return self.device.get("status") == "active"
