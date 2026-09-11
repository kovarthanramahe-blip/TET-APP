-- ============================================================================
-- HTET Preparation — Phase 3C seed migration
-- Seeds shared/reference data ONLY, transcribed byte-for-byte from:
--   app/src/data/syllabus.js  -> courses, modules, topics
--   app/src/data/quizBank.js  -> quiz_questions
--   app/src/data/flashcards.js -> flashcards
--   app/src/data/badges.js    -> badge_defs
--
-- Seeds NO user-owned data (no profiles, topic_confidence, study_sessions,
-- tasks, notes, quiz_attempts, quiz_attempt_answers, flashcard_srs_state,
-- or badge_awards).
--
-- Requires 20260908_flashcards_front_unique.sql to have been run first.
-- Idempotent: safe to run more than once, every insert is ON CONFLICT DO
-- NOTHING against a real unique constraint.
-- ============================================================================

-- ============================================================================
-- 1) courses (3 rows)
-- ============================================================================
insert into public.courses (title, position) values
  ('Level 1 (PRT)', 0),
  ('Level 2 (TGT)', 1),
  ('Level 3 (PGT)', 2)
on conflict (title) do nothing;

-- ============================================================================
-- 2) modules (15 rows)
-- ============================================================================
insert into public.modules (course_id, name, marks_weight, position)
select c.id, v.name, v.marks_weight, v.position
from (values
  ('Level 1 (PRT)', 'Child Development & Pedagogy', 30, 0),
  ('Level 1 (PRT)', 'Language I — Hindi', 15, 1),
  ('Level 1 (PRT)', 'Language II — English', 15, 2),
  ('Level 1 (PRT)', 'General Studies', 30, 3),
  ('Level 1 (PRT)', 'Subject — Maths & EVS', 60, 4),
  ('Level 2 (TGT)', 'Child Development & Pedagogy', 30, 0),
  ('Level 2 (TGT)', 'Language I — Hindi', 15, 1),
  ('Level 2 (TGT)', 'Language II — English', 15, 2),
  ('Level 2 (TGT)', 'General Studies', 30, 3),
  ('Level 2 (TGT)', 'Subject — Social Studies', 60, 4),
  ('Level 3 (PGT)', 'Child Development & Pedagogy', 30, 0),
  ('Level 3 (PGT)', 'Language I — Hindi', 15, 1),
  ('Level 3 (PGT)', 'Language II — English', 15, 2),
  ('Level 3 (PGT)', 'General Studies', 30, 3),
  ('Level 3 (PGT)', 'Subject specialisation (PGT)', 60, 4)
) as v(course_title, name, marks_weight, position)
join public.courses c on c.title = v.course_title
on conflict (course_id, name) do nothing;

-- ============================================================================
-- 3) topics (83 rows)
-- ============================================================================
insert into public.topics (module_id, name, description, position)
select m.id, v.name, v.description, v.position
from (values
  -- Level 1 (PRT) · Child Development & Pedagogy (6)
  ('Level 1 (PRT)', 'Child Development & Pedagogy', 'Growth & development — concept and principles', 'Heredity vs environment · stages', 0),
  ('Level 1 (PRT)', 'Child Development & Pedagogy', 'Theories of learning', 'Piaget · Vygotsky · Bruner · Kohlberg', 1),
  ('Level 1 (PRT)', 'Child Development & Pedagogy', 'Individual differences', 'Intelligence · aptitude · personality', 2),
  ('Level 1 (PRT)', 'Child Development & Pedagogy', 'Inclusive education', 'CWSN · learning difficulties · RTE 2009', 3),
  ('Level 1 (PRT)', 'Child Development & Pedagogy', 'Assessment & evaluation', 'CCE · formative vs summative · NCF 2005', 4),
  ('Level 1 (PRT)', 'Child Development & Pedagogy', 'Motivation & classroom management', 'Reinforcement · discipline · group dynamics', 5),
  -- Level 1 (PRT) · Language I — Hindi (5)
  ('Level 1 (PRT)', 'Language I — Hindi', 'Varn vichar, sandhi, samas', 'Swar/vyanjan · deergh · gun · vriddhi', 0),
  ('Level 1 (PRT)', 'Language I — Hindi', 'Alankar and ras', 'Anupras · upma · rupak · nav ras', 1),
  ('Level 1 (PRT)', 'Language I — Hindi', 'Muhavare and lokoktiyan', 'Idioms and proverbs in context', 2),
  ('Level 1 (PRT)', 'Language I — Hindi', 'Apathit gadyansh', 'Unseen passage comprehension', 3),
  ('Level 1 (PRT)', 'Language I — Hindi', 'Hindi shikshan vidhi', 'Teaching methods and TLM', 4),
  -- Level 1 (PRT) · Language II — English (6)
  ('Level 1 (PRT)', 'Language II — English', 'Tenses and modals', 'Sequence of tenses · usage errors', 0),
  ('Level 1 (PRT)', 'Language II — English', 'Articles and prepositions', 'High-frequency HTET error patterns', 1),
  ('Level 1 (PRT)', 'Language II — English', 'Voice and narration', 'Active/passive · direct/indirect', 2),
  ('Level 1 (PRT)', 'Language II — English', 'Vocabulary and idioms', 'Synonyms · antonyms · one-word substitution', 3),
  ('Level 1 (PRT)', 'Language II — English', 'Unseen passage', 'Inference and vocabulary in context', 4),
  ('Level 1 (PRT)', 'Language II — English', 'English pedagogy', 'LSRW skills · remedial teaching', 5),
  -- Level 1 (PRT) · General Studies (6)
  ('Level 1 (PRT)', 'General Studies', 'Quantitative aptitude', 'Number system · percentage · time-speed', 0),
  ('Level 1 (PRT)', 'General Studies', 'Reasoning and mental ability', 'Series · analogy · coding-decoding', 1),
  ('Level 1 (PRT)', 'General Studies', 'Haryana GK — history & culture', 'Formation 1966 · festivals · folk arts', 2),
  ('Level 1 (PRT)', 'General Studies', 'Haryana GK — geography & economy', 'Rivers · districts · agriculture', 3),
  ('Level 1 (PRT)', 'General Studies', 'Indian polity and current affairs', 'Constitution · schemes · education policy', 4),
  ('Level 1 (PRT)', 'General Studies', 'Teaching aptitude', 'Communication · professional ethics', 5),
  -- Level 1 (PRT) · Subject — Maths & EVS (6)
  ('Level 1 (PRT)', 'Subject — Maths & EVS', 'Number system and operations', 'Place value · factors · HCF/LCM', 0),
  ('Level 1 (PRT)', 'Subject — Maths & EVS', 'Fractions, decimals, percentage', 'Word problems', 1),
  ('Level 1 (PRT)', 'Subject — Maths & EVS', 'Geometry and measurement', 'Shapes · perimeter · area · volume', 2),
  ('Level 1 (PRT)', 'Subject — Maths & EVS', 'Data handling', 'Pictographs · bar graphs · averages', 3),
  ('Level 1 (PRT)', 'Subject — Maths & EVS', 'Plants, animals and the body', 'EVS living world', 4),
  ('Level 1 (PRT)', 'Subject — Maths & EVS', 'Environment and resources', 'Water · air · pollution · conservation', 5),

  -- Level 2 (TGT) · Child Development & Pedagogy (6)
  ('Level 2 (TGT)', 'Child Development & Pedagogy', 'Adolescent development', 'Physical · cognitive · socio-emotional', 0),
  ('Level 2 (TGT)', 'Child Development & Pedagogy', 'Learning theories applied', 'Constructivism · social learning', 1),
  ('Level 2 (TGT)', 'Child Development & Pedagogy', 'Guidance and counselling', 'Adjustment · school counselling', 2),
  ('Level 2 (TGT)', 'Child Development & Pedagogy', 'Inclusive education', 'Diversity · differentiated instruction', 3),
  ('Level 2 (TGT)', 'Child Development & Pedagogy', 'Assessment for learning', 'Rubrics · question paper design', 4),
  ('Level 2 (TGT)', 'Child Development & Pedagogy', 'Action research', 'Reflective practice', 5),
  -- Level 2 (TGT) · Language I — Hindi (5)
  ('Level 2 (TGT)', 'Language I — Hindi', 'Vyakaran — sandhi, samas, karak', 'Advanced grammar', 0),
  ('Level 2 (TGT)', 'Language I — Hindi', 'Kavya and alankar', 'Chhand · ras · alankar', 1),
  ('Level 2 (TGT)', 'Language I — Hindi', 'Rachnatmak lekhan', 'Patra · nibandh', 2),
  ('Level 2 (TGT)', 'Language I — Hindi', 'Apathit gadyansh', 'Comprehension', 3),
  ('Level 2 (TGT)', 'Language I — Hindi', 'Bhasha shikshan', 'Pedagogy of Hindi at TGT level', 4),
  -- Level 2 (TGT) · Language II — English (5)
  ('Level 2 (TGT)', 'Language II — English', 'Advanced grammar', 'Clauses · conditionals · concord', 0),
  ('Level 2 (TGT)', 'Language II — English', 'Transformation of sentences', 'Synthesis · reported speech', 1),
  ('Level 2 (TGT)', 'Language II — English', 'Comprehension and precis', 'Summarising skills', 2),
  ('Level 2 (TGT)', 'Language II — English', 'Vocabulary building', 'Phrasal verbs · confusables', 3),
  ('Level 2 (TGT)', 'Language II — English', 'Pedagogy of English', 'Communicative approach', 4),
  -- Level 2 (TGT) · General Studies (5)
  ('Level 2 (TGT)', 'General Studies', 'Quantitative aptitude', 'Ratio · profit-loss · mensuration', 0),
  ('Level 2 (TGT)', 'General Studies', 'Logical reasoning', 'Syllogism · blood relations · direction', 1),
  ('Level 2 (TGT)', 'General Studies', 'Haryana GK', 'Polity · schemes · sports · culture', 2),
  ('Level 2 (TGT)', 'General Studies', 'National and international affairs', 'Last 12 months', 3),
  ('Level 2 (TGT)', 'General Studies', 'Computer and educational technology', 'ICT in teaching', 4),
  -- Level 2 (TGT) · Subject — Social Studies (6)
  ('Level 2 (TGT)', 'Subject — Social Studies', 'Ancient and medieval India', 'Sources · empires · Panipat battles', 0),
  ('Level 2 (TGT)', 'Subject — Social Studies', 'Modern India and national movement', '1857 to 1947', 1),
  ('Level 2 (TGT)', 'Subject — Social Studies', 'Physical and Indian geography', 'Landforms · climate · resources', 2),
  ('Level 2 (TGT)', 'Subject — Social Studies', 'Indian Constitution and polity', 'Rights · duties · federalism', 3),
  ('Level 2 (TGT)', 'Subject — Social Studies', 'Economics fundamentals', 'Development · budget · planning', 4),
  ('Level 2 (TGT)', 'Subject — Social Studies', 'Pedagogy of social science', 'Map work · projects · sources', 5),

  -- Level 3 (PGT) · Child Development & Pedagogy (6)
  ('Level 3 (PGT)', 'Child Development & Pedagogy', 'Senior-secondary learner psychology', 'Identity · career choice', 0),
  ('Level 3 (PGT)', 'Child Development & Pedagogy', 'Advanced learning theories', 'Information processing · metacognition', 1),
  ('Level 3 (PGT)', 'Child Development & Pedagogy', 'Educational measurement', 'Reliability · validity · item analysis', 2),
  ('Level 3 (PGT)', 'Child Development & Pedagogy', 'Inclusive and value education', 'Equity · life skills', 3),
  ('Level 3 (PGT)', 'Child Development & Pedagogy', 'Curriculum and NEP 2020', 'Design · vocationalisation', 4),
  ('Level 3 (PGT)', 'Child Development & Pedagogy', 'Educational management', 'Leadership · school administration', 5),
  -- Level 3 (PGT) · Language I — Hindi (5)
  ('Level 3 (PGT)', 'Language I — Hindi', 'Vyakaran samagra', 'Full grammar revision', 0),
  ('Level 3 (PGT)', 'Language I — Hindi', 'Hindi sahitya ka itihas', 'Kaal vibhajan · pramukh kavi', 1),
  ('Level 3 (PGT)', 'Language I — Hindi', 'Alankar, chhand, ras', 'Kavya shastra', 2),
  ('Level 3 (PGT)', 'Language I — Hindi', 'Apathit gadyansh', 'Analytical reading', 3),
  ('Level 3 (PGT)', 'Language I — Hindi', 'Bhasha shikshan shastra', 'PGT-level pedagogy', 4),
  -- Level 3 (PGT) · Language II — English (5)
  ('Level 3 (PGT)', 'Language II — English', 'Grammar and usage', 'Error spotting at advanced level', 0),
  ('Level 3 (PGT)', 'Language II — English', 'Literary devices', 'Figures of speech · prosody', 1),
  ('Level 3 (PGT)', 'Language II — English', 'Comprehension and interpretation', 'Critical reading', 2),
  ('Level 3 (PGT)', 'Language II — English', 'Academic writing', 'Report · argument', 3),
  ('Level 3 (PGT)', 'Language II — English', 'ELT approaches', 'Task-based · post-method', 4),
  -- Level 3 (PGT) · General Studies (5)
  ('Level 3 (PGT)', 'General Studies', 'Quantitative aptitude', 'Data interpretation · algebra', 0),
  ('Level 3 (PGT)', 'General Studies', 'Analytical reasoning', 'Puzzles · statements & assumptions', 1),
  ('Level 3 (PGT)', 'General Studies', 'Haryana GK in depth', 'Administration · economy · history', 2),
  ('Level 3 (PGT)', 'General Studies', 'Current affairs and policy', 'Education policy · schemes', 3),
  ('Level 3 (PGT)', 'General Studies', 'Research and ICT literacy', 'Digital pedagogy', 4),
  -- Level 3 (PGT) · Subject specialisation (PGT) (6)
  ('Level 3 (PGT)', 'Subject specialisation (PGT)', 'Core concepts — unit I', 'Foundational theory of the subject', 0),
  ('Level 3 (PGT)', 'Subject specialisation (PGT)', 'Core concepts — unit II', 'Applied and analytical topics', 1),
  ('Level 3 (PGT)', 'Subject specialisation (PGT)', 'Advanced problems and cases', 'Higher-order questions', 2),
  ('Level 3 (PGT)', 'Subject specialisation (PGT)', 'Recent developments', 'Contemporary scholarship', 3),
  ('Level 3 (PGT)', 'Subject specialisation (PGT)', 'Subject pedagogy', 'Lab/field work · project method', 4),
  ('Level 3 (PGT)', 'Subject specialisation (PGT)', 'Previous-year analysis', 'Ten-year question trends', 5)
) as v(course_title, module_name, name, description, position)
join public.courses c on c.title = v.course_title
join public.modules m on m.course_id = c.id and m.name = v.module_name
on conflict (module_id, name) do nothing;

-- ============================================================================
-- 4) quiz_questions (16 rows)
-- ============================================================================
insert into public.quiz_questions (type, part, question_text, options, answer, explanation) values
  ('mcq', 'Child Development & Pedagogy',
   'In which Piagetian stage does a child first develop object permanence?',
   '["Sensorimotor","Pre-operational","Concrete operational","Formal operational"]'::jsonb,
   '0'::jsonb,
   'Object permanence appears late in the sensorimotor stage (0–2 years).'),

  ('mcq', 'Child Development & Pedagogy',
   'Vygotsky''s Zone of Proximal Development refers to the gap between',
   '["Two children of the same age","What a learner can do alone and what they can do with guidance","Intelligence and aptitude","Formative and summative assessment"]'::jsonb,
   '1'::jsonb,
   'The ZPD is the distance between independent performance and assisted performance.'),

  ('tf', 'Child Development & Pedagogy',
   'Kohlberg''s theory is primarily concerned with moral development.',
   '["True","False"]'::jsonb,
   '0'::jsonb,
   'Kohlberg proposed six stages across three levels of moral reasoning.'),

  ('mcq', 'Child Development & Pedagogy',
   'NCF 2005 recommends that learning be primarily',
   '["Rote and text-bound","Constructivist and child-centred","Teacher-dominated","Examination-driven"]'::jsonb,
   '1'::jsonb,
   'NCF 2005 shifted the emphasis to constructivist, experience-based learning.'),

  ('mcq', 'Language II — English',
   'He has been living in Rohtak ___ 2010.',
   '["for","since","from","by"]'::jsonb,
   '1'::jsonb,
   '"Since" is used with a point in time; "for" with a duration.'),

  ('fib', 'Language II — English',
   'Change to passive voice: "She writes a letter." → A letter ___ written by her.',
   null,
   '"is"'::jsonb,
   'Simple present passive takes is/are + past participle.'),

  ('mcq', 'Language I — Hindi',
   '"Vidyalaya" (Vidya + Alaya) is an example of which sandhi?',
   '["Deergh sandhi","Gun sandhi","Vriddhi sandhi","Yan sandhi"]'::jsonb,
   '0'::jsonb,
   'A + A = AA, so it is deergh (long-vowel) sandhi.'),

  ('mcq', 'General Studies',
   'Haryana attained statehood on',
   '["1 November 1956","1 November 1966","26 January 1950","15 August 1947"]'::jsonb,
   '1'::jsonb,
   'Haryana was carved out of Punjab on 1 November 1966.'),

  ('mcq', 'General Studies',
   'The HCF of 12 and 18 is',
   '["2","3","6","36"]'::jsonb,
   '2'::jsonb,
   '12 = 2²×3, 18 = 2×3²; common factors give 6.'),

  ('mcq', 'General Studies',
   'A train covers 60 km in 45 minutes. Its speed is',
   '["75 km/h","80 km/h","85 km/h","90 km/h"]'::jsonb,
   '1'::jsonb,
   '60 ÷ 0.75 h = 80 km/h.'),

  ('mcq', 'General Studies',
   'Complete the series: 2, 6, 12, 20, ___',
   '["24","28","30","32"]'::jsonb,
   '2'::jsonb,
   'Differences run 4, 6, 8, 10 → 20 + 10 = 30.'),

  ('fib', 'General Studies',
   'The sum of the interior angles of a triangle is ___ degrees.',
   null,
   '"180"'::jsonb,
   'A fundamental result of Euclidean geometry.'),

  ('tf', 'General Studies',
   'HTET is conducted by the Board of School Education Haryana, Bhiwani.',
   '["True","False"]'::jsonb,
   '0'::jsonb,
   'BSEH Bhiwani conducts HTET on behalf of the state.'),

  ('mcq', 'Subject',
   'The Third Battle of Panipat was fought in',
   '["1526","1556","1761","1857"]'::jsonb,
   '2'::jsonb,
   'Marathas were defeated by Ahmad Shah Abdali in 1761.'),

  ('mcq', 'Subject',
   'In the number 4,507, the place value of 5 is',
   '["5","50","500","5000"]'::jsonb,
   '2'::jsonb,
   '5 sits in the hundreds place.'),

  ('sa', 'Child Development & Pedagogy',
   'In one or two lines, define formative assessment.',
   null,
   '"Assessment conducted during learning to give feedback and shape teaching."'::jsonb,
   'Formative assessment is continuous, diagnostic and feeds back into instruction.')
on conflict (part, question_text) do nothing;

-- ============================================================================
-- 5) flashcards (10 rows) — order matches CARDS[] exactly; Phase 3D needs
--    this order preserved to map each user's localStorage array-index key
--    to the resulting row id.
-- ============================================================================
insert into public.flashcards (front, back, category) values
  ('Piaget — four stages, in order', 'Sensorimotor (0–2) · Pre-operational (2–7) · Concrete operational (7–11) · Formal operational (11+)', 'Child Development'),
  ('Kohlberg — three levels', 'Pre-conventional · Conventional · Post-conventional (two stages each)', 'Child Development'),
  ('RTE Act year and age range', '2009 · free and compulsory education for ages 6–14', 'Polity'),
  ('Haryana — formation date and capital', '1 November 1966 · Chandigarh', 'Haryana GK'),
  ('Rivers of Haryana', 'Yamuna · Ghaggar · Markanda · Saraswati (seasonal)', 'Haryana GK'),
  ('CCE — what the two Cs stand for', 'Continuous and Comprehensive Evaluation — scholastic plus co-scholastic', 'Assessment'),
  ('Passive voice — simple present formula', 'Object + is/are + past participle + by + subject', 'English'),
  ('Deergh sandhi rule', 'Similar vowels combine into their long form: a + a = aa', 'Hindi'),
  ('NEP 2020 school structure', '5 + 3 + 3 + 4 — foundational, preparatory, middle, secondary', 'Policy'),
  ('HTET paper pattern', '150 MCQs · 150 marks · 150 minutes · no negative marking', 'Exam craft')
on conflict (front) do nothing;

-- ============================================================================
-- 6) badge_defs (10 rows) — order matches BADGE_DEFS[] exactly; slugs as
--    approved.
-- ============================================================================
insert into public.badge_defs (id, name, description, metric, target) values
  ('first-session', 'First Session', 'Log your first study session.', 'sessions', 1),
  ('ten-hours-in', 'Ten Hours In', 'Ten hours of tracked study.', 'hours', 10),
  ('fifty-hours-in', 'Fifty Hours In', 'Fifty hours of tracked study.', 'hours', 50),
  ('week-of-discipline', 'Week of Discipline', 'A seven-day unbroken streak.', 'streak', 7),
  ('month-of-discipline', 'Month of Discipline', 'A thirty-day unbroken streak.', 'streak', 30),
  ('qualifier', 'Qualifier', 'Score 60% or more on any test.', 'best', 60),
  ('distinction', 'Distinction', 'Score 85% or more on any test.', 'best', 85),
  ('green-ten', 'Green Ten', 'Mark ten topics as mastered.', 'mastered', 10),
  ('task-machine', 'Task Machine', 'Complete twenty study tasks.', 'tasksDone', 20),
  ('card-shark', 'Card Shark', 'Grade fifty flashcard reviews.', 'reviews', 50)
on conflict (id) do nothing;

-- ============================================================================
-- End of Phase 3C seed. No user-owned tables touched. No localStorage
-- migration performed. No application code changed.
-- ============================================================================
