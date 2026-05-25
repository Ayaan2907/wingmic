/**
 * English stopwords used by the Layer-2 heuristic topic extractor.
 *
 * Compiled by hand from common lists (SMART, NLTK, spaCy) plus the
 * conversational fillers the H4 code review flagged as leaking through
 * (going, gonna, well, okay, right, sort, kind, thing, things, talked, etc.).
 *
 * Keep this list lowercase. Add new entries as we observe noise words
 * climbing into top-3 topic rankings during eval runs.
 */
export const STOPWORDS: ReadonlySet<string> = new Set([
  // articles
  'the', 'this', 'that', 'these', 'those',
  // pronouns
  'they', 'them', 'their', 'theirs', 'themselves',
  'this', 'that', 'these', 'those',
  'what', 'which', 'who', 'whom', 'whose',
  'mine', 'yours', 'hers', 'ours', 'theirs',
  'myself', 'yourself', 'himself', 'herself', 'itself', 'ourselves', 'yourselves',
  // possessives
  'his', 'her', 'hers', 'its', 'our', 'ours', 'your', 'yours',
  // be / aux verbs
  'are', 'was', 'were', 'been', 'being',
  'have', 'has', 'had', 'having',
  'does', 'did', 'doing', 'done',
  // modals
  'would', 'could', 'should', 'might', 'must', 'will', 'shall', 'can', 'cannot',
  // negations
  'not', 'never', 'none', 'nope',
  // prepositions / conjunctions
  'and', 'but', 'for', 'nor', 'yet',
  'with', 'without', 'within', 'into', 'onto', 'upon', 'about', 'against',
  'between', 'through', 'during', 'before', 'after', 'above', 'below',
  'from', 'down', 'over', 'under', 'again', 'further', 'while', 'because',
  'since', 'until', 'although', 'though', 'unless', 'whereas',
  // adverbs / fillers
  'also', 'even', 'still', 'only', 'just', 'like', 'really', 'very', 'much',
  'more', 'most', 'less', 'least', 'some', 'any', 'all', 'each', 'every',
  'both', 'few', 'many', 'several', 'such', 'same', 'other', 'another',
  'maybe', 'perhaps', 'actually', 'definitely', 'probably', 'basically',
  'literally', 'honestly', 'seriously', 'usually', 'rarely', 'often',
  'sometimes', 'always',
  // wh- + relative
  'when', 'where', 'why', 'how', 'than', 'then',
  'here', 'there', 'everywhere', 'anywhere', 'somewhere', 'nowhere',
  // time / date filler
  'today', 'tomorrow', 'yesterday', 'tonight', 'morning', 'evening',
  'week', 'weeks', 'month', 'months', 'year', 'years', 'soon', 'later',
  // conversational fillers flagged by code review
  'going', 'gonna', 'wanna', 'gotta', 'kinda', 'sorta',
  'well', 'okay', 'right', 'sure', 'yeah', 'yep', 'nope',
  'sort', 'kind', 'stuff',
  'thing', 'things', 'something', 'someone', 'somebody', 'anything', 'anyone',
  'anybody', 'nothing', 'nobody', 'everything', 'everyone', 'everybody',
  // common verbs that aren't topics
  'talk', 'talks', 'talked', 'talking',
  'said', 'says', 'saying',
  'know', 'known', 'knew', 'knows', 'knowing',
  'think', 'thinks', 'thought', 'thinking',
  'mean', 'means', 'meant', 'meaning',
  'want', 'wants', 'wanted', 'wanting',
  'need', 'needs', 'needed', 'needing',
  'make', 'makes', 'made', 'making',
  'take', 'takes', 'took', 'taken', 'taking',
  'give', 'gives', 'gave', 'given', 'giving',
  'come', 'comes', 'came', 'coming',
  'tell', 'tells', 'told', 'telling',
  'work', 'works', 'worked', 'working',
  'look', 'looks', 'looked', 'looking',
  // pronouns continued
  'you', 'one', 'ones', 'self',
  // misc
  'back', 'out', 'off', 'around', 'across', 'along', 'beside', 'behind',
  'beyond', 'inside', 'outside', 'near', 'next', 'last', 'first',
  'lot', 'lots', 'bit', 'bits', 'part', 'parts',
  'okay', 'good', 'bad', 'fine', 'great',
]);
