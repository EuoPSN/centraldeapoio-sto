CREATE TABLE IF NOT EXISTS simulator_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES client_profiles(id) ON DELETE SET NULL,
  profile_name text,
  difficulty text,
  nota integer NOT NULL DEFAULT 0,
  resumo text,
  pontos_fortes jsonb DEFAULT '[]',
  pontos_melhoria jsonb DEFAULT '[]',
  erros jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE simulator_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuarios veem seus proprios resultados" ON simulator_results
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Usuarios inserem seus proprios resultados" ON simulator_results
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins veem todos os resultados" ON simulator_results
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS xp integer NOT NULL DEFAULT 0;
