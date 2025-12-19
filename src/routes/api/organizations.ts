// 組織管理API
import { Hono } from 'hono'
import type { AppEnv } from '../../types'
import { getCurrentUser } from '../../utils/auth'

const routes = new Hono<AppEnv>()

// 現在のユーザーの組織情報を取得
routes.get('/organizations/current', async (c) => {
  const user = await getCurrentUser(c)
  if (!user || !user.organization_id) {
    return c.json({ error: 'Not authenticated or no organization' }, 401)
  }

  const org = await c.env.DB.prepare(`
    SELECT 
      id, name, slug, email, phone, address, representative_name,
      business_type, status, business_scope,
      -- 資格情報
      gyoseishoshi_license_number, gyoseishoshi_license_name, gyoseishoshi_registered_at,
      sharoshi_license_number, sharoshi_license_name, sharoshi_registered_at,
      document_creation_mode, license_verified, license_verified_at,
      legal_disclaimer_agreed, legal_disclaimer_agreed_at,
      created_at, updated_at
    FROM organizations
    WHERE id = ?
  `).bind(user.organization_id).first()

  if (!org) {
    return c.json({ error: 'Organization not found' }, 404)
  }

  return c.json(org)
})

// 組織情報を更新
routes.put('/organizations/current', async (c) => {
  const user = await getCurrentUser(c)
  if (!user || !user.organization_id) {
    return c.json({ error: 'Not authenticated or no organization' }, 401)
  }

  const body = await c.req.json()
  
  // 更新可能なフィールド（基本情報）
  const allowedFields = [
    'name', 'email', 'phone', 'address', 'representative_name', 'business_type'
  ]
  
  const updates: string[] = []
  const values: any[] = []
  
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updates.push(`${field} = ?`)
      values.push(body[field])
    }
  }
  
  if (updates.length === 0) {
    return c.json({ error: 'No fields to update' }, 400)
  }
  
  updates.push('updated_at = CURRENT_TIMESTAMP')
  values.push(user.organization_id)
  
  await c.env.DB.prepare(`
    UPDATE organizations
    SET ${updates.join(', ')}
    WHERE id = ?
  `).bind(...values).run()

  return c.json({ success: true })
})

// 資格情報を更新
routes.put('/organizations/current/licenses', async (c) => {
  const user = await getCurrentUser(c)
  if (!user || !user.organization_id) {
    return c.json({ error: 'Not authenticated or no organization' }, 401)
  }

  // 管理者権限チェック（オーナーまたは管理者のみ）
  if (user.role !== 'admin' && user.role !== 'owner') {
    return c.json({ error: 'Permission denied. Only admin or owner can update license information.' }, 403)
  }

  const body = await c.req.json()
  
  // 資格関連フィールド
  const licenseFields = [
    'gyoseishoshi_license_number', 'gyoseishoshi_license_name', 'gyoseishoshi_registered_at',
    'sharoshi_license_number', 'sharoshi_license_name', 'sharoshi_registered_at',
    'document_creation_mode'
  ]
  
  const updates: string[] = []
  const values: any[] = []
  
  for (const field of licenseFields) {
    if (body[field] !== undefined) {
      updates.push(`${field} = ?`)
      values.push(body[field] || null)
    }
  }
  
  if (updates.length === 0) {
    return c.json({ error: 'No license fields to update' }, 400)
  }
  
  // 資格情報が入力された場合、verified をリセット（再確認が必要）
  if (body.gyoseishoshi_license_number || body.sharoshi_license_number) {
    updates.push('license_verified = 0')
    updates.push('license_verified_at = NULL')
  }
  
  updates.push('updated_at = CURRENT_TIMESTAMP')
  values.push(user.organization_id)
  
  await c.env.DB.prepare(`
    UPDATE organizations
    SET ${updates.join(', ')}
    WHERE id = ?
  `).bind(...values).run()

  return c.json({ success: true })
})

// 法的免責事項への同意を記録
routes.post('/organizations/current/legal-disclaimer', async (c) => {
  const user = await getCurrentUser(c)
  if (!user || !user.organization_id) {
    return c.json({ error: 'Not authenticated or no organization' }, 401)
  }

  const { agreed } = await c.req.json()
  
  if (!agreed) {
    return c.json({ error: 'Must agree to legal disclaimer' }, 400)
  }

  await c.env.DB.prepare(`
    UPDATE organizations
    SET legal_disclaimer_agreed = 1,
        legal_disclaimer_agreed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(user.organization_id).run()

  return c.json({ success: true })
})

// 組織の資格ステータスを取得（書類作成機能用）
routes.get('/organizations/current/license-status', async (c) => {
  const user = await getCurrentUser(c)
  if (!user || !user.organization_id) {
    return c.json({ error: 'Not authenticated or no organization' }, 401)
  }

  const org = await c.env.DB.prepare(`
    SELECT 
      gyoseishoshi_license_number,
      sharoshi_license_number,
      document_creation_mode,
      license_verified,
      legal_disclaimer_agreed
    FROM organizations
    WHERE id = ?
  `).bind(user.organization_id).first() as any

  if (!org) {
    return c.json({ error: 'Organization not found' }, 404)
  }

  // 資格ステータスを判定
  const hasGyoseishoshi = !!org.gyoseishoshi_license_number
  const hasSharoshi = !!org.sharoshi_license_number
  const isLicensed = hasGyoseishoshi || hasSharoshi
  const isVerified = org.license_verified === 1
  const hasAgreedDisclaimer = org.legal_disclaimer_agreed === 1

  // 書類作成モードの判定
  let effectiveMode = org.document_creation_mode || 'client_self'
  
  // 資格がない場合は強制的に顧客自己作成モード
  if (!isLicensed) {
    effectiveMode = 'client_self'
  }

  return c.json({
    hasGyoseishoshi,
    hasSharoshi,
    isLicensed,
    isVerified,
    hasAgreedDisclaimer,
    documentCreationMode: org.document_creation_mode,
    effectiveMode,
    canCreateDocumentsForClient: isLicensed && isVerified && effectiveMode !== 'client_self',
    message: !isLicensed 
      ? '資格情報が未登録のため、書類作成は顧客が自己作成する必要があります。'
      : !isVerified 
        ? '資格情報の確認が完了していません。確認完了後、代行作成が可能になります。'
        : null
  })
})

export default routes
