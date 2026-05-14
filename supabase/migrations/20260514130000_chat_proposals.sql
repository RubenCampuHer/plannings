-- M8.2: Function calling al copilot.
-- Afegim columna `proposals` JSONB a plan_messages. Estructura:
--   [
--     {
--       "id": "uuid",
--       "function_name": "add_place" | "add_checklist_item" | "add_subplan",
--       "arguments": { ... },
--       "status": "pending" | "applied" | "cancelled",
--       "result_message": "Afegit Cinema Verdi al mapa" | null,
--       "result_path": "/plans/cinema-verdi" | null,
--       "applied_at": "2026-05-14T12:34:56Z" | null
--     }
--   ]
--
-- Només els missatges role='assistant' poden tenir propostes. Si la columna és
-- NULL o array buit, no n'hi ha cap.

alter table plan_messages add column proposals jsonb;
