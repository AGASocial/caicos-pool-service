-- Allow company users to delete report photo metadata (used when technician removes a photo from a report)
CREATE POLICY "Company users can delete report photos"
ON caicos_report_photos FOR DELETE
USING (company_id = get_my_company_id());
