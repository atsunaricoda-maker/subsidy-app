// 案件進捗ボード - /cases に統合済み。リダイレクトのみ。
import { Hono } from 'hono'
import type { AppEnv } from '../../types'

const routes = new Hono<AppEnv>()

routes.get('/pipeline', (c) => {
  return c.redirect('/cases')
})

export default routes;
