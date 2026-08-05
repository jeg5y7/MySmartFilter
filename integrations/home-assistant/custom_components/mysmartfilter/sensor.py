"""Sensors: filter life, pressure, temperature, battery, wasted energy cost."""
from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass

from homeassistant.components.sensor import (
    SensorDeviceClass,
    SensorEntity,
    SensorEntityDescription,
    SensorStateClass,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import PERCENTAGE, UnitOfPressure, UnitOfTemperature
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from . import MySmartFilterCoordinator
from .const import DOMAIN
from .entity import MySmartFilterEntity


@dataclass(frozen=True, kw_only=True)
class MySmartFilterSensorDescription(SensorEntityDescription):
    value_fn: Callable[[dict], float | int | None]


SENSORS: tuple[MySmartFilterSensorDescription, ...] = (
    MySmartFilterSensorDescription(
        key="filter_life",
        translation_key="filter_life",
        native_unit_of_measurement=PERCENTAGE,
        state_class=SensorStateClass.MEASUREMENT,
        icon="mdi:air-filter",
        value_fn=lambda d: d.get("filterLifePct"),
    ),
    MySmartFilterSensorDescription(
        key="pressure_drop",
        translation_key="pressure_drop",
        native_unit_of_measurement=UnitOfPressure.PA,
        device_class=SensorDeviceClass.PRESSURE,
        state_class=SensorStateClass.MEASUREMENT,
        value_fn=lambda d: (d.get("latestReading") or {}).get("pressure"),
    ),
    MySmartFilterSensorDescription(
        key="temperature",
        translation_key="temperature",
        native_unit_of_measurement=UnitOfTemperature.CELSIUS,
        device_class=SensorDeviceClass.TEMPERATURE,
        state_class=SensorStateClass.MEASUREMENT,
        value_fn=lambda d: (d.get("latestReading") or {}).get("temperature"),
    ),
    MySmartFilterSensorDescription(
        key="battery",
        translation_key="battery",
        native_unit_of_measurement=PERCENTAGE,
        device_class=SensorDeviceClass.BATTERY,
        state_class=SensorStateClass.MEASUREMENT,
        value_fn=lambda d: d.get("batteryPct"),
    ),
    MySmartFilterSensorDescription(
        key="wasted_energy_cost",
        translation_key="wasted_energy_cost",
        native_unit_of_measurement="¢",
        state_class=SensorStateClass.TOTAL_INCREASING,
        icon="mdi:cash-clock",
        value_fn=lambda d: d.get("extraEnergyCostCents"),
    ),
    MySmartFilterSensorDescription(
        key="blower_runtime",
        translation_key="blower_runtime",
        native_unit_of_measurement="h",
        state_class=SensorStateClass.TOTAL_INCREASING,
        icon="mdi:fan-clock",
        value_fn=lambda d: d.get("runtimeHours"),
    ),
)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    coordinator: MySmartFilterCoordinator = hass.data[DOMAIN][entry.entry_id]
    entities = [
        MySmartFilterSensor(coordinator, device_id, description)
        for device_id in coordinator.data
        for description in SENSORS
    ]
    async_add_entities(entities)


class MySmartFilterSensor(MySmartFilterEntity, SensorEntity):
    entity_description: MySmartFilterSensorDescription

    def __init__(
        self,
        coordinator: MySmartFilterCoordinator,
        device_id: str,
        description: MySmartFilterSensorDescription,
    ) -> None:
        super().__init__(coordinator, device_id)
        self.entity_description = description
        self._attr_unique_id = f"{device_id}_{description.key}"

    @property
    def native_value(self) -> float | int | None:
        return self.entity_description.value_fn(self.device)
