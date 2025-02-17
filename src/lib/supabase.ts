
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://ceinvnueokxhrlwngfny.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNlaW52bnVlb2t4aHJsd25nZm55Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzk3OTI0NDEsImV4cCI6MjA1NTM2ODQ0MX0.TAIkxPACdwDx2_k8b6GrOVCUXn9oCJ-QtIfWTyAjZCU';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
