"""Base entity: one HA device per smart filter monitor."""
from __future__ import annotations

from homeassistant.helpers.device_registry import DeviceInfo
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from . import MySmartFilterCoordinator
from .const import DOMAIN


class MySmartFilterEntity(CoordinatorEntity[MySmartFilterCoordinator]):
    """Couples an entity to one monitor in the coordinator data."""

    _attr_has_entity_name = True

    def __init__(self, coordinator: MySmartFilterCoordinator, device_id: str) -> None:
        super().__init__(coordinator)
        self._device_id = device_id

    @property
    def device(self) -> dict:
        return self.coordinator.data[self._device_id]

    @property
    def available(self) -> bool:
        return super().available and self._device_id in self.coordinator.data

    @property
    def device_info(self) -> DeviceInfo:
        d = self.device
        return DeviceInfo(
            identifiers={(DOMAIN, self._device_id)},
            name=d.get("name") or self._device_id,
            manufacturer="MySmartFilter",
            model="Smart Filter Monitor",
            sw_version=d.get("firmware"),
            suggested_area=d.get("location"),
            configuration_url="https://www.mysmartfilter.com/dashboard",
        )
