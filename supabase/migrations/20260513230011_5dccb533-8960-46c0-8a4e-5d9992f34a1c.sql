UPDATE public.documents
SET aeat_status = 'Correcto',
    aeat_csv = '20260506172220364197',
    aeat_error_message = '',
    aeat_submitted_at = '2026-05-06 15:22:20+00'
WHERE formatted_number = 'Factura abr-2026-003'
  AND aeat_response_xml ILIKE '%20260506172220364197%';