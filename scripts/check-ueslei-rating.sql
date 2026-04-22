SET search_path = tenant_sls;

-- Evaluations do Ueslei agrupadas
SELECT "evaluatorType", COUNT(*) AS n, ROUND(AVG(score)::numeric, 2) AS media
FROM "Evaluation"
WHERE "partnerId" = '86d06a8a-23f5-46d3-9d98-0f00067223f1'
  AND score > 0
GROUP BY "evaluatorType";

-- Pesos e minRating da company
SELECT "evalGestorWeight", "evalClientWeight", "evalMinRating"
FROM "Company"
WHERE id = '00000000-0000-0000-0000-000000000002';

-- Rating atual do Ueslei
SELECT id, name, rating, status FROM "Partner" WHERE id = '86d06a8a-23f5-46d3-9d98-0f00067223f1';
