// 採択事例API
import { Hono } from 'hono'
import type { AppEnv } from '../../types'
import { getCurrentUser } from '../../utils/auth'

const routes = new Hono<AppEnv>()

routes.get('/success-cases', async (c) => {
  const { DB } = c.env
  const subsidyTypeId = c.req.query('subsidy_type_id')
  
  let query = `
    SELECT sc.*, st.name as subsidy_name
    FROM success_cases sc
    LEFT JOIN subsidy_types st ON sc.subsidy_type_id = st.id
    WHERE sc.is_public = 1
  `
  
  if (subsidyTypeId) {
    query += ` AND sc.subsidy_type_id = ${subsidyTypeId}`
  }
  
  query += ` ORDER BY sc.fiscal_year DESC`
  
  const result = await DB.prepare(query).all()
  
  return c.json(result.results)
})

export default routes
