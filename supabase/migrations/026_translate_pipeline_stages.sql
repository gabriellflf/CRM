-- Translate default English pipeline stage names to Portuguese.
-- Only renames rows where the name exactly matches the original English seeds,
-- so custom stages created by users are left untouched.
UPDATE pipeline_stages SET name = 'Novo Lead'        WHERE name = 'New Lead';
UPDATE pipeline_stages SET name = 'Qualificado'      WHERE name = 'Qualified';
UPDATE pipeline_stages SET name = 'Proposta Enviada' WHERE name = 'Proposal Sent';
UPDATE pipeline_stages SET name = 'Negociação'       WHERE name = 'Negotiation';
UPDATE pipeline_stages SET name = 'Ganho'            WHERE name = 'Won';
