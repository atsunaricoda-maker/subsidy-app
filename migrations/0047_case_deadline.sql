-- Add deadline column to cases table for individual case deadlines
ALTER TABLE cases ADD COLUMN deadline DATE;

-- Add guideline_id to link case to specific guideline version
ALTER TABLE cases ADD COLUMN guideline_id INTEGER REFERENCES subsidy_guidelines(id);
