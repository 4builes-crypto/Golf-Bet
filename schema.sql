-- GOLF BET: Database Schema

-- 1. Profiles Table (Linked to Supabase Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    display_name TEXT,
    handicap FLOAT DEFAULT 0.0,
    avatar_url TEXT,
    total_xp INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile." ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- 2. Rounds Table
CREATE TABLE IF NOT EXISTS public.rounds (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    course_name TEXT NOT NULL,
    date TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    status TEXT CHECK (status IN ('active', 'completed')) DEFAULT 'active',
    created_by UUID REFERENCES public.profiles(id),
    is_deleted BOOLEAN DEFAULT false
);

-- 3. Round Players
CREATE TABLE IF NOT EXISTS public.round_players (
    round_id UUID REFERENCES public.rounds(id) ON DELETE CASCADE,
    player_id UUID REFERENCES public.profiles(id),
    handicap_at_round FLOAT,
    PRIMARY KEY (round_id, player_id)
);

-- 4. Scores
CREATE TABLE IF NOT EXISTS public.scores (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    round_id UUID REFERENCES public.rounds(id) ON DELETE CASCADE,
    player_id UUID REFERENCES public.profiles(id),
    hole_number INTEGER CHECK (hole_number >= 1 AND hole_number <= 18),
    strokes INTEGER DEFAULT 0,
    putts INTEGER DEFAULT 0,
    UNIQUE (round_id, player_id, hole_number)
);

-- 5. Bets
CREATE TABLE IF NOT EXISTS public.bets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    round_id UUID REFERENCES public.rounds(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    bet_type TEXT NOT NULL, -- 'skins', 'match_play', 'nassau', etc.
    amount NUMERIC NOT NULL,
    currency TEXT CHECK (currency IN ('COP', 'USD')) DEFAULT 'COP',
    config JSONB DEFAULT '{}'::jsonb
);

-- 6. Real-time setup
-- Add tables to the supabase_realtime publication
-- Note: This is usually done in the Supabase UI, but can be done via SQL
-- ALTER PUBLICATION supabase_realtime ADD TABLE scores, rounds, bets;
