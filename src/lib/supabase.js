import { createClient } from '@supabase/supabase-js'
const supabaseUrl='https://qamkfjdhpxvuqjcqfklm.supabase.co'
const supabaseAnonKey='sb_publishable_IIXfXvgUCiDd4_d-CxKx9w_DHMBjU32'
export const supabase=createClient(supabaseUrl, supabaseAnonKey)