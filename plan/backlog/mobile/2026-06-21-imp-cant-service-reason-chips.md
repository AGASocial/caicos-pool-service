# Chips de razones — Can't Service

**Created:** 2026-06-21  
**Type:** imp  
**Priority:** High  
**Agent:** React Native Developer  
**App:** technician-app + supabase  
**Status:** DONE

## Summary

Catálogo `cadenza_cant_service_reasons` por compañía + chips multiselect en pantalla can't-service. Los slugs seleccionados se guardan en `cadenza_service_reports.cant_service_reasons`. Admin muestra badges en Service Report.

## Razones iniciales

| Slug | Label |
|------|-------|
| gate_locked | Puerta cerrada |
| client_cancelled | Cliente canceló |
| client_not_home | Cliente no está |
| dog_in_yard | Perro en el patio |
| access_blocked | Acceso bloqueado |
| bad_weather | Clima adverso |
| pool_under_repair | Piscina en reparación |
| vehicle_blocking | Vehículo bloqueando acceso |

## Deploy

```bash
supabase db push
```
