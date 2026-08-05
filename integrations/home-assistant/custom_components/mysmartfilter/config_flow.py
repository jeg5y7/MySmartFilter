"""Config flow: paste your MySmartFilter API key (Settings → Integrations)."""
from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant.config_entries import ConfigFlow, ConfigFlowResult
from homeassistant.const import CONF_API_KEY
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .api import MySmartFilterApiError, MySmartFilterAuthError, MySmartFilterClient
from .const import DOMAIN

DATA_SCHEMA = vol.Schema({vol.Required(CONF_API_KEY): str})


class MySmartFilterConfigFlow(ConfigFlow, domain=DOMAIN):
    """Single-step flow validating the API key against the cloud."""

    VERSION = 1

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        errors: dict[str, str] = {}

        if user_input is not None:
            client = MySmartFilterClient(
                async_get_clientsession(self.hass), user_input[CONF_API_KEY]
            )
            try:
                devices = await client.async_get_devices()
            except MySmartFilterAuthError:
                errors["base"] = "invalid_auth"
            except MySmartFilterApiError:
                errors["base"] = "cannot_connect"
            else:
                await self.async_set_unique_id(user_input[CONF_API_KEY][-8:])
                self._abort_if_unique_id_configured()
                return self.async_create_entry(
                    title=f"MySmartFilter ({len(devices)} monitor{'s' if len(devices) != 1 else ''})",
                    data=user_input,
                )

        return self.async_show_form(
            step_id="user", data_schema=DATA_SCHEMA, errors=errors
        )
