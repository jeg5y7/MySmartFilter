# MySmartFilter × Home Assistant

Brings your smart filter monitor into Home Assistant: filter life, pressure
drop, temperature, battery, wasted-energy cost, and a **Replace filter**
problem sensor you can automate on.

## Install (manual, ~2 minutes)

1. Copy `custom_components/mysmartfilter/` into your Home Assistant
   `config/custom_components/` folder.
2. Restart Home Assistant.
3. **Settings → Devices & Services → Add Integration → MySmartFilter.**
4. Paste an API key from
   [mysmartfilter.com → Settings → Integrations](https://www.mysmartfilter.com/settings/integrations).

Each monitor appears as a device with these entities:

| Entity | What it is |
|---|---|
| `sensor.<name>_filter_life` | % of filter value remaining (100 = fresh) |
| `sensor.<name>_filter_pressure_drop` | Live ΔP across the filter (Pa) |
| `sensor.<name>_temperature` | Utility-room temperature |
| `sensor.<name>_battery` | Battery % (battery models) |
| `sensor.<name>_wasted_energy_cost` | ¢ of extra electricity this filter has cost |
| `sensor.<name>_blower_runtime` | Blower hours on this filter |
| `binary_sensor.<name>_replace_filter` | On when replacement saves money |

## Example automation

```yaml
automation:
  - alias: "Filter needs replacing — light the hallway lamp red"
    trigger:
      - platform: state
        entity_id: binary_sensor.furnace_replace_filter
        to: "on"
    action:
      - service: light.turn_on
        target: { entity_id: light.hallway }
        data: { color_name: red }
```

## Notes

- Cloud-polling every 2 minutes via the public API (`GET /api/v1/devices`).
- Battery monitors upload hourly, so their values step hourly — alerts still
  push to your email/phone immediately via the MySmartFilter cloud.
- HACS: this folder will move to a dedicated repository for HACS listing;
  manual install works today.
