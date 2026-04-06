import { createClient } from '@supabase/supabase-js'

// A URL você encontra na aba "General" (Configurações Gerais) do Supabase
const supabaseUrl = 'https://ikjygbipngscqjaidiai.supabase.co' 

// Esta é a chave que aparece na sua última foto (Legacy anon public)
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlranlnYmlwbmdzY3FqYWlkaWFpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0OTMwNjYsImV4cCI6MjA5MTA2OTA2Nn0.rhTB8BGjSHj_xl-1MOdX7j_Z33MdXFMi__yWFwdz2io' 

export const supabase = createClient(supabaseUrl, supabaseAnonKey)