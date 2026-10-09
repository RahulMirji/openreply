\pset pager off
\echo '=== WEBHOOK EVENTS, last 60 min (all) ==='
SELECT "createdAt",
       CASE WHEN payload::text LIKE '%"field": "comments"%'
              OR payload::text LIKE '%"field":"comments"%' THEN 'COMMENT'
            WHEN payload::text LIKE '%messaging%' THEN 'MESSAGING'
            ELSE 'OTHER' END AS kind,
       left(payload::text, 230) AS head
FROM "WebhookEvent"
WHERE "createdAt" > now() - interval '60 minutes'
ORDER BY "createdAt" DESC;

\echo '=== ANY comment-field webhook in last 24h? ==='
SELECT count(*) FROM "WebhookEvent"
WHERE "createdAt" > now() - interval '24 hours'
  AND (payload::text LIKE '%"field": "comments"%' OR payload::text LIKE '%"field":"comments"%');

\echo '=== OPERATIONAL EVENTS last 60 min ==='
SELECT "createdAt", level, left(message, 130) FROM "OperationalEvent"
WHERE "createdAt" > now() - interval '60 minutes' ORDER BY "createdAt" DESC LIMIT 15;

\echo '=== PIPELINE ==='
SELECT (SELECT count(*) FROM "ProcessedComment") AS processed,
       (SELECT count(*) FROM "DmLog") AS dmlogs,
       now() AS db_now;
