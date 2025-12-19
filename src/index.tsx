import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { AppEnv } from './types'
import { generateSidebar, sidebarStyles, sidebarScripts } from './templates/sidebar'

// API Routes
import admin_usersRoutes from './routes/api/admin-users'
import ai_chatRoutes from './routes/api/ai-chat'
import aiRoutes from './routes/api/ai'
import announcementsRoutes from './routes/api/announcements'
import authRoutes from './routes/api/auth'
import backupRoutes from './routes/api/backup'
import bank_infoRoutes from './routes/api/bank-info'
import casesRoutes from './routes/api/cases'
import clientsRoutes from './routes/api/clients'
import common_documentsRoutes from './routes/api/common-documents'
import communicationsRoutes from './routes/api/communications'
import cronRoutes from './routes/api/cron'
import dashboard_statsRoutes from './routes/api/dashboard-stats'
import document_analysisRoutes from './routes/api/document-analysis'
import document_checklistRoutes from './routes/api/document-checklist'
import document_generationRoutes from './routes/api/document-generation'
import documentsRoutes from './routes/api/documents'
import edit_historyRoutes from './routes/api/edit-history'
import exportRoutes from './routes/api/export'
import guidelinesRoutes from './routes/api/guidelines'
import hearing_questionsRoutes from './routes/api/hearing-questions'
import invoicesRoutes from './routes/api/invoices'
import multi_matchingRoutes from './routes/api/multi-matching'
import paymentsRoutes from './routes/api/payments'
import pipelinesRoutes from './routes/api/pipelines'
import predictionRoutes from './routes/api/prediction'
import site_settingsRoutes from './routes/api/site-settings'
import stripe_subscriptionRoutes from './routes/api/stripe-subscription'
import stripeRoutes from './routes/api/stripe'
import subscriptionRoutes from './routes/api/subscription'
import subsidy_matchingRoutes from './routes/api/subsidy-matching'
import subsidy_typesRoutes from './routes/api/subsidy-types'
import success_casesRoutes from './routes/api/success-cases'
import admin_settingsPages from './routes/pages/admin-settings'
import admin_usersPages from './routes/pages/admin-users'
import backupPages from './routes/pages/backup'
import case_detailPages from './routes/pages/case-detail'
import casesPages from './routes/pages/cases'
import client_detailPages from './routes/pages/client-detail'
import clientsPages from './routes/pages/clients'
import dashboardPages from './routes/pages/dashboard'
import guidelinesPages from './routes/pages/guidelines'
import legalPages from './routes/pages/legal'
import master_adminsPages from './routes/pages/master-admins'
import master_billingPages from './routes/pages/master-billing'
import master_dataPages from './routes/pages/master-data'
import master_legalPages from './routes/pages/master-legal'
import master_logsPages from './routes/pages/master-logs'
import master_plansPages from './routes/pages/master-plans'
import masterPages from './routes/pages/master'
import pipelinesPages from './routes/pages/pipelines'
import portalPages from './routes/pages/portal'
import statisticsPages from './routes/pages/statistics'
import subsidy_typesPages from './routes/pages/subsidy-types'
import authPages from './routes/pages/auth'

const app = new Hono<AppEnv>()

// CORS設定
app.use('/api/*', cors())

// Mount routes
app.route('/api', admin_usersRoutes)
app.route('/api', ai_chatRoutes)
app.route('/api', aiRoutes)
app.route('/api', announcementsRoutes)
app.route('/api', authRoutes)
app.route('/api', backupRoutes)
app.route('/api', bank_infoRoutes)
app.route('/api', casesRoutes)
app.route('/api', clientsRoutes)
app.route('/api', common_documentsRoutes)
app.route('/api', communicationsRoutes)
app.route('/api', cronRoutes)
app.route('/api', dashboard_statsRoutes)
app.route('/api', document_analysisRoutes)
app.route('/api', document_checklistRoutes)
app.route('/api', document_generationRoutes)
app.route('/api', documentsRoutes)
app.route('/api', edit_historyRoutes)
app.route('/api', exportRoutes)
app.route('/api', guidelinesRoutes)
app.route('/api', hearing_questionsRoutes)
app.route('/api', invoicesRoutes)
app.route('/api', multi_matchingRoutes)
app.route('/api', paymentsRoutes)
app.route('/api', pipelinesRoutes)
app.route('/api', predictionRoutes)
app.route('/api', site_settingsRoutes)
app.route('/api', stripe_subscriptionRoutes)
app.route('/api', stripeRoutes)
app.route('/api', subscriptionRoutes)
app.route('/api', subsidy_matchingRoutes)
app.route('/api', subsidy_typesRoutes)
app.route('/api', success_casesRoutes)
app.route('', admin_settingsPages)
app.route('', admin_usersPages)
app.route('', backupPages)
app.route('', case_detailPages)
app.route('', casesPages)
app.route('', client_detailPages)
app.route('', clientsPages)
app.route('', dashboardPages)
app.route('', guidelinesPages)
app.route('', legalPages)
app.route('', master_adminsPages)
app.route('', master_billingPages)
app.route('', master_dataPages)
app.route('', master_legalPages)
app.route('', master_logsPages)
app.route('', master_plansPages)
app.route('', masterPages)
app.route('', pipelinesPages)
app.route('', portalPages)
app.route('', statisticsPages)
app.route('', subsidy_typesPages)
app.route('', authPages)

// Re-export templates for use in routes
export { generateSidebar, sidebarStyles, sidebarScripts }

export default app
