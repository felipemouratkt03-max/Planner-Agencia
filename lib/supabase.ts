
import { createClient } from '@supabase/supabase-js';

// URL do projeto Supabase
const supabaseUrl = 'https://ftuflhnihmdziepnlcsc.supabase.co';

// Chave anônima (anon public) fornecida pelo usuário
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ0dWZsaG5paG1kemllcG5sY3NjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjcxMzE2NzgsImV4cCI6MjA4MjcwNzY3OH0.g4bD9n_wiY7_IgMFI7qN9vDeFxSvRR8Zcv8tn06Oe54';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
