import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'URL'
const supabaseAnonKey = 'CHEIE'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)