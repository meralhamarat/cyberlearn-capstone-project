"""
GeminiQuestionService — PDF dokümanından Gemini ile çoktan seçmeli sorular üretir.
30 soru: 10 kolay (ELO 700-900), 10 orta (ELO 950-1100), 10 zor (ELO 1150-1400).
Gemini erişilemezse PDF metninden yerel yedek sorular üretilir.
Üretilen sorular is_approved=False olarak kaydedilir.
"""

import json
import os
import random
import re
from collections import Counter
from typing import Any, Dict, List, Optional, Tuple

from dotenv import load_dotenv

load_dotenv()

_gemini_client = None


# ──────────────────────────────────────────────────────────────────────────────
# Gemini client
# ──────────────────────────────────────────────────────────────────────────────

def _get_gemini_client():
    global _gemini_client
    if _gemini_client is None:
        from google import genai
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError("GEMINI_API_KEY tanımlı değil")
        _gemini_client = genai.Client(api_key=api_key)
    return _gemini_client


# ──────────────────────────────────────────────────────────────────────────────
# PDF extraction
# ──────────────────────────────────────────────────────────────────────────────

def _extract_text_from_pdf(file_path: str) -> str:
    try:
        import pdfplumber
        with pdfplumber.open(file_path) as pdf:
            text = "\n".join(page.extract_text() or "" for page in pdf.pages)
        return text[:12000]
    except ImportError:
        try:
            import PyPDF2
            with open(file_path, "rb") as f:
                reader = PyPDF2.PdfReader(f)
                text = "\n".join(page.extract_text() or "" for page in reader.pages)
            return text[:12000]
        except ImportError:
            raise RuntimeError(
                "PDF okuma kütüphanesi bulunamadı. "
                "'pip install pdfplumber' veya 'pip install PyPDF2' çalıştırın."
            )


# ──────────────────────────────────────────────────────────────────────────────
# NLP helpers for fallback (zero external dependencies)
# ──────────────────────────────────────────────────────────────────────────────
def _detect_pdf_type(text: str) -> str:
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    colon_lines = sum(1 for l in lines if re.search(r'.{2,30}\s*[:\/]\s*.{2,30}', l))
    ratio = colon_lines / max(len(lines), 1)
    if ratio > 0.3:
        return "vocabulary_list"
    return "normal"


def _extract_vocabulary_pairs(text: str) -> List[Dict[str, str]]:
    pairs = []
    pattern = re.compile(r'^(?:\d+[\.\)]\s*)?([A-Za-zÇĞİÖŞÜçğışöü\s\-]{2,40})\s*[:/]\s*(.{2,80})$')
    for line in text.splitlines():
        line = line.strip()
        m = pattern.match(line)
        if m:
            word = m.group(1).strip()
            meaning = m.group(2).strip()
            if len(word) >= 2 and not word.isdigit() and len(meaning) >= 2:
                pairs.append({"word": word, "meaning": meaning})
    return pairs


def _build_vocabulary_questions(
    pairs: List[Dict[str, str]],
    level: str,
    count: int,
    document_id: int,
    classroom_id: int,
    teacher_id: int,
) -> List:
    from app.models.db_models import Question

    if len(pairs) < 4:
        return []

    difficulty_elo = {
        "easy":   (700, 900),
        "medium": (950, 1100),
        "hard":   (1150, 1400),
    }
    elo_min, elo_max = difficulty_elo[level]

    def make_question(pair, all_pairs, level):
        word = pair["word"]
        meaning = pair["meaning"]
        other_pairs = [p for p in all_pairs if p["word"] != word]
        random.shuffle(other_pairs)
        wrong_meanings = [p["meaning"] for p in other_pairs[:3]]
        wrong_words = [p["word"] for p in other_pairs[:3]]
        if len(wrong_meanings) < 3:
            return None
        if level == "easy":
            q = f'"{word}" kelimesinin Türkçe anlamı aşağıdakilerden hangisidir?'
            correct = meaning
            options = [meaning] + wrong_meanings
        elif level == "medium":
            q = f'"{meaning}" anlamına gelen İngilizce kelime hangisidir?'
            correct = word
            options = [word] + wrong_words
        else:
            q = "Aşağıdaki eşleştirmelerden hangisi doğrudur?"
            correct = f"{word} → {meaning}"
            wrong_options = [
                f"{other_pairs[0]['word']} → {meaning}",
                f"{word} → {other_pairs[0]['meaning']}",
                f"{other_pairs[1]['word']} → {other_pairs[1]['meaning']}",
            ]
            options = [correct] + wrong_options
        random.shuffle(options)
        return q, options, correct

    questions = []
    used_words = set()
    available = [p for p in pairs if p["word"] not in used_words]
    random.shuffle(available)
    for pair in available[:count]:
        result = make_question(pair, pairs, level)
        if result is None:
            continue
        q_text, options, correct = result
        used_words.add(pair["word"])
        questions.append(
            Question(
                text=q_text,
                options=json.dumps(options, ensure_ascii=False),
                correct_answer=correct,
                elo_rating=random.randint(elo_min, elo_max),
                classroom_id=classroom_id,
                document_id=document_id,
                created_by_teacher=teacher_id,
                is_approved=False,
            )
        )
    return questions

def _split_sentences(text: str) -> List[str]:
    """Splits text into clean sentences of at least 6 words."""
    raw = re.split(r"(?<=[.!?])\s+|[\n]{2,}", text)
    return [s.strip() for s in raw if len(s.split()) >= 6]


def _extract_key_terms(text: str) -> List[str]:
    """
    Extracts domain-specific terms without external NLP libs.
    Priority: capitalized multi-word phrases → ALL-CAPS acronyms → quoted terms.
    Returns up to 40 unique terms sorted by frequency.
    """
    patterns = [
        r'\b([A-ZÇĞİÖŞÜ][a-zçğışöüA-ZÇĞİÖŞÜ]+(?:\s+[A-ZÇĞİÖŞÜ][a-zçğışöüA-ZÇĞİÖŞÜ]+){1,4})\b',
        r'\b([A-ZÇĞİÖŞÜ]{2,8})\b',
        r'[""«»„]([^""«»„]{4,40})[""«»„]',
        r'\(([A-ZÇĞİÖŞÜ][A-Za-zçğışöüÇĞİÖŞÜ\s]{2,30})\)',
    ]
    stopwords = {
        "Bu", "The", "Bir", "Ve", "Ile", "Bu", "Da", "De", "Ki", "Ne",
        "Için", "Olan", "Olan", "Veya", "Ancak", "Fakat", "Ise", "Gibi",
    }
    candidates: List[str] = []
    for pat in patterns:
        found = re.findall(pat, text)
        for hit in found:
            term = hit.strip() if isinstance(hit, str) else hit[0].strip()
            if term and term not in stopwords and len(term) > 2:
                candidates.append(term)

    freq = Counter(candidates)
    return [term for term, _ in freq.most_common(40)]


def _extract_numeric_facts(text: str) -> List[Tuple[str, str]]:
    """
    Finds sentences containing numeric facts (years, percentages, measurements).
    Returns list of (number_string, full_sentence) tuples.
    """
    results: List[Tuple[str, str]] = []
    units = r'(%|km|mg|kg|ml|°C|°F|Hz|MHz|GHz|yıl|metre|meter|cm|km²|kW|MW|adet|kişi|ton)'
    pattern = re.compile(rf'\b(\d[\d.,]*\s*{units}?)\b')
    for sentence in _split_sentences(text):
        m = pattern.search(sentence)
        if m:
            results.append((m.group(1).strip(), sentence))
    return results[:12]


def _extract_definitions(text: str) -> List[Dict[str, str]]:
    """
    Detects 'X is/means/refers to Y' definition patterns.
    Returns list of {"term": ..., "definition": ..., "sentence": ...}.
    """
    patterns = [
        # English
        r'([A-Z][a-zA-Z\s]{2,30})\s+(?:is defined as|is called|refers to|means|is)\s+([^.!?]{10,120})',
        # Turkish
        r'([A-ZÇĞİÖŞÜ][a-zçğışöüA-ZÇĞİÖŞÜ\s]{2,30})\s+(?:olarak tanımlanır|olarak adlandırılır|anlamına gelir|demektir|şeklinde tanımlanır)\s*[,:]?\s*([^.!?]{10,120})',
        # "X: definition" colon pattern
        r'\b([A-ZÇĞİÖŞÜ][a-zçğışöüA-ZÇĞİÖŞÜ\s]{2,25}):\s+([A-ZÇĞİÖŞÜa-zçğışöü][^.!?]{15,120})',
    ]
    results: List[Dict[str, str]] = []
    seen_terms: set = set()
    for pat in patterns:
        for m in re.finditer(pat, text):
            term = m.group(1).strip()
            definition = m.group(2).strip()
            if term.lower() not in seen_terms and len(definition.split()) >= 4:
                seen_terms.add(term.lower())
                results.append({
                    "term": term,
                    "definition": definition,
                    "sentence": m.group(0).strip(),
                })
    return results[:15]


def _truncate(text: str, max_len: int = 110) -> str:
    text = text.strip()
    return text if len(text) <= max_len else text[:max_len - 3] + "..."


# ──────────────────────────────────────────────────────────────────────────────
# Question builders — each returns a (question_text, options, correct) triple
# ──────────────────────────────────────────────────────────────────────────────

def _build_definition_question(
    defn: Dict[str, str],
    all_terms: List[str],
    all_definitions: List[Dict],          # ← bu satırı ekle
) -> Optional[Tuple[str, List[str], str]]:
    term = defn["term"]
    correct = _truncate(defn["definition"])
    distractor_pool = [
        d["definition"] for d in all_definitions if d["term"] != term  # ← değişti
    ] + all_terms
    distractors = [_truncate(d) for d in distractor_pool if d != correct][:3]
    if len(distractors) < 3:
        return None
    options = [correct] + distractors
    random.shuffle(options)
    q = f'"{term}" kavramı aşağıdakilerden hangisiyle tanımlanabilir?'
    return q, options, correct


def _build_numeric_question(
    num: str,
    sentence: str,
    other_sentences: List[str],
) -> Optional[Tuple[str, List[str], str]]:
    """'Which value / measurement is mentioned regarding X?' type question."""
    # Mask the number in the sentence to form the question stem
    stem_sentence = re.sub(re.escape(num), "______", sentence, count=1)
    if "______" not in stem_sentence:
        return None
    q = f"Aşağıdaki ifadede boş bırakılan yere hangi değer gelmelidir?\n« {_truncate(stem_sentence, 140)} »"
    correct = num

    # Generate plausible numeric distractors by perturbing the value
    try:
        base = float(re.sub(r'[^\d.]', '', num.replace(',', '.')))
        multipliers = [0.5, 2.0, 10.0]
        wrong_nums = [str(int(base * m)) if base * m >= 1 else f"{base * m:.2f}"
                      for m in multipliers]
    except ValueError:
        wrong_nums = ["100", "250", "500"]

    options = [correct] + wrong_nums[:3]
    random.shuffle(options)
    return q, options, correct


def _build_term_in_context_question(
    term: str,
    sentences: List[str],
    all_terms: List[str],
) -> Optional[Tuple[str, List[str], str]]:
    """'Which term fits the described context?' — cloze over a real sentence."""
    # Find a sentence that actually contains this term
    containing = [s for s in sentences if term in s]
    if not containing:
        return None
    sentence = random.choice(containing)
    masked = sentence.replace(term, "______", 1)
    if "______" not in masked:
        return None

    q = f"Aşağıdaki cümlede boşluğa hangi terim/kavram gelmelidir?\n« {_truncate(masked, 150)} »"
    correct = term
    # Distractors: other key terms
    distractors = [t for t in all_terms if t != term][:3]
    if len(distractors) < 3:
        return None
    options = [correct] + distractors
    random.shuffle(options)
    return q, options, correct


def _build_cause_effect_question(
    sentence: str,
    other_sentences: List[str],
) -> Optional[Tuple[str, List[str], str]]:
    """Detects causal sentences and asks about the effect."""
    causal_markers = [
        r'(.+?)\s+(?:nedeniyle|yüzünden|dolayısıyla|sonucunda|bunun için)\s+(.+)',
        r'(.+?)\s+(?:because|therefore|thus|as a result|consequently)\s+(.+)',
        r'(.+?)\s+(?:neden olur|yol açar|ortaya çıkarır)\s*[,.]?\s*(.+)',
    ]
    for pat in causal_markers:
        m = re.search(pat, sentence, re.IGNORECASE)
        if m:
            cause = m.group(1).strip()
            effect = m.group(2).strip()
            if len(cause.split()) >= 3 and len(effect.split()) >= 3:
                correct = _truncate(effect)
                q = (
                    f"Aşağıdaki durumun sonucu olarak ne beklenir?\n"
                    f"« {_truncate(cause, 120)} »"
                )
                distractors = [
                    _truncate(s) for s in other_sentences
                    if s != sentence and len(s.split()) >= 5
                ][:3]
                if len(distractors) < 3:
                    return None
                options = [correct] + distractors
                random.shuffle(options)
                return q, options, correct
    return None


def _build_exception_question(
    term: str,
    sentences: List[str],
    all_terms: List[str],
) -> Optional[Tuple[str, List[str], str]]:
    """'Which of the following is NOT related to [TERM]?' — tests discrimination."""
    # Find 3 sentences that DO mention the term → true options
    related = [_truncate(s) for s in sentences if term in s][:3]
    if len(related) < 3:
        return None
    # The "correct" answer (i.e. the NOT-related one) comes from unrelated sentences
    unrelated = [_truncate(s) for s in sentences if term not in s and len(s.split()) >= 5]
    if not unrelated:
        return None
    correct = random.choice(unrelated)
    q = f'Aşağıdakilerden hangisi "{term}" ile doğrudan ilişkili DEĞİLDİR?'
    options = related[:3] + [correct]
    random.shuffle(options)
    return q, options, correct


def _build_sequence_question(
    sentences: List[str],
) -> Optional[Tuple[str, List[str], str]]:
    """
    Finds numbered/ordered sentences and asks what comes next/before.
    Falls back to asking which sentence logically continues a given one.
    """
    ordered_patterns = [
        r'(?:birinci|ilk|önce|first|step 1|1\.)\s+(.+)',
        r'(?:ikinci|ardından|then|step 2|2\.)\s+(.+)',
        r'(?:son olarak|finally|lastly|son adım)\s+(.+)',
    ]
    steps = []
    for pat in ordered_patterns:
        for s in sentences:
            if re.search(pat, s, re.IGNORECASE):
                steps.append(s)
    if len(steps) >= 2:
        idx = random.randint(0, len(steps) - 2)
        trigger = steps[idx]
        correct = _truncate(steps[idx + 1])
        q = (
            f"Aşağıdaki adımdan sonra hangi aşama gelir?\n"
            f"« {_truncate(trigger, 120)} »"
        )
        distractors = [_truncate(s) for s in sentences if s not in steps][:3]
        if len(distractors) < 3:
            return None
        options = [correct] + distractors
        random.shuffle(options)
        return q, options, correct
    return None


# ──────────────────────────────────────────────────────────────────────────────
# Difficulty wrappers — add cognitive load per ELO tier
# ──────────────────────────────────────────────────────────────────────────────

_EASY_BUILDERS = ["definition", "term_cloze", "numeric"]
_MEDIUM_BUILDERS = ["cause_effect", "term_cloze", "numeric", "sequence"]
_HARD_BUILDERS = ["exception", "cause_effect", "sequence"]


def _attempt_build(
    builder_name: str,
    sentences: List[str],
    terms: List[str],
    definitions: List[Dict],
    numeric_facts: List[Tuple[str, str]],
    used_sentences: set,
) -> Optional[Tuple[str, List[str], str]]:
    """Dispatch to the right builder and return (q, options, correct) or None."""
    available = [s for s in sentences if s not in used_sentences]
    if not available:
        available = sentences  # reset if exhausted

    if builder_name == "definition" and definitions:
        defn = random.choice(definitions)
        return _build_definition_question(defn, terms, definitions)

    if builder_name == "term_cloze" and terms:
        term = random.choice(terms)
        return _build_term_in_context_question(term, available, terms)

    if builder_name == "numeric" and numeric_facts:
        num, sentence = random.choice(numeric_facts)
        return _build_numeric_question(num, sentence, available)

    if builder_name == "cause_effect":
        random.shuffle(available)
        for s in available:
            result = _build_cause_effect_question(s, [x for x in sentences if x != s])
            if result:
                return result

    if builder_name == "exception" and terms:
        term = random.choice(terms)
        return _build_exception_question(term, sentences, terms)

    if builder_name == "sequence":
        return _build_sequence_question(sentences)

    return None


# ──────────────────────────────────────────────────────────────────────────────
# Public fallback entry point
# ──────────────────────────────────────────────────────────────────────────────

def generate_fallback_questions_from_text(
    text: str,
    document_id: int,
    classroom_id: int,
    teacher_id: int,
    question_count: int = 30,
) -> List:
    """
    Gemini erişilemezse PDF metninden dinamik çoktan seçmeli sorular üretir.
    Sabit şablon yerine metinden çıkarılan terim/tanım/sayı/nedensellik kullanır.
    """
    from app.models.db_models import Question

    # ── PDF tipini algıla ──────────────────────────────────────────────────
    pdf_type = _detect_pdf_type(text)
    per_level = max(1, question_count // 3)

    if pdf_type == "vocabulary_list":
        print(f"[Fallback] Kelime listesi PDF'i algılandı, vocabulary modu aktif.")
        pairs = _extract_vocabulary_pairs(text)
        print(f"[Fallback] {len(pairs)} kelime çifti bulundu.")
        questions = []
        for level in ["easy", "medium", "hard"]:
            questions += _build_vocabulary_questions(
                pairs, level, per_level,
                document_id, classroom_id, teacher_id
            )
        print(f"[Fallback] {len(questions)} soru üretildi.")
        return questions

    # ── Normal PDF akışı ───────────────────────────────────────────────────
    sentences = _split_sentences(text)
    if not sentences:
        return []

    # ── Pre-extract content signals once ──────────────────────────────────────
    terms = _extract_key_terms(text)
    definitions = _extract_definitions(text)
    numeric_facts = _extract_numeric_facts(text)

    per_level = max(1, question_count // 3)
    difficulty_config = {
        "easy":   {"elo_range": (700,  900),  "builders": _EASY_BUILDERS},
        "medium": {"elo_range": (950,  1100), "builders": _MEDIUM_BUILDERS},
        "hard":   {"elo_range": (1150, 1400), "builders": _HARD_BUILDERS},
    }

    questions = []
    used_questions: set = set()   # deduplicate question stems
    used_sentences: set = set()   # spread coverage across the document

    for level, cfg in difficulty_config.items():
        elo_min, elo_max = cfg["elo_range"]
        builders = cfg["builders"]
        count = 0
        attempts = 0
        max_attempts = per_level * 8  # avoid infinite loops

        while count < per_level and attempts < max_attempts:
            attempts += 1
            builder_name = builders[count % len(builders)]

            result = _attempt_build(
                builder_name, sentences, terms, definitions,
                numeric_facts, used_sentences,
            )

            # ── Hard fallback: sentence-pair true/false if builders fail ──────
            if result is None:
                available = [s for s in sentences if s not in used_sentences]
                if not available:
                    available = sentences
                sentence = random.choice(available)
                correct = _truncate(sentence)
                others = [_truncate(s) for s in sentences if s != sentence][:3]
                if len(others) < 3:
                    others += ["Bu bilgi metinde yer almamaktadır."] * (3 - len(others))
                options = [correct] + others[:3]
                random.shuffle(options)

                # Generate a varied question stem based on content signals
                stem = _dynamic_stem_for_sentence(sentence, terms, level)
                result = (stem, options, correct)

            q_text, options, correct = result

            # Skip duplicates
            if q_text in used_questions:
                continue

            used_questions.add(q_text)
            used_sentences.add(correct)

            elo = random.randint(elo_min, elo_max)
            questions.append(
                Question(
                    text=q_text,
                    options=json.dumps(options, ensure_ascii=False),
                    correct_answer=correct,
                    elo_rating=elo,
                    classroom_id=classroom_id,
                    document_id=document_id,
                    created_by_teacher=teacher_id,
                    is_approved=False,
                )
            )
            count += 1

    print(
        f"[Fallback] {len(questions)} soru üretildi (document_id={document_id}): "
        f"{sum(1 for q in questions if q.elo_rating <= 900)} kolay, "
        f"{sum(1 for q in questions if 900 < q.elo_rating <= 1100)} orta, "
        f"{sum(1 for q in questions if q.elo_rating > 1100)} zor"
    )
    return questions


def _dynamic_stem_for_sentence(
    sentence: str,
    terms: List[str],
    level: str,
) -> str:
    """
    Generates a content-aware question stem instead of a hardcoded template.
    Uses terms detected in the sentence itself when possible.
    """
    # Find which known terms appear in this sentence
    found_terms = [t for t in terms if t in sentence]
    anchor = found_terms[0] if found_terms else None

    # Pool of stem patterns — varied by difficulty and anchor availability
    if anchor:
        easy_stems = [
            f'"{anchor}" hakkında aşağıdaki bilgilerden hangisi doğrudur?',
            f'"{anchor}" kavramıyla ilgili aşağıdakilerden hangisi metne uygundur?',
            f'Aşağıdakilerden hangisi "{anchor}" terimini doğru tanımlar?',
        ]
        medium_stems = [
            f'"{anchor}" ile ilgili aşağıdaki çıkarımlardan hangisi metne dayanmaktadır?',
            f'"{anchor}" bağlamında aşağıdaki ifadelerden hangisi geçerlidir?',
            f'"{anchor}" kavramının işlevi düşünüldüğünde hangisi doğru bir değerlendirmedir?',
        ]
        hard_stems = [
            f'"{anchor}" hakkındaki bilgiler sentezlendiğinde aşağıdakilerden hangisine ulaşılır?',
            f'Aşağıdakilerden hangisi "{anchor}" ile çelişen bir yargı içermektedir?',
            f'"{anchor}" bağlamında hangi önermeler birlikte doğru olamaz?',
        ]
    else:
        easy_stems = [
            "Aşağıdakilerden hangisi metinde geçen bir bilgiyi yansıtmaktadır?",
            "Aşağıdaki ifadelerden hangisi metindeki bilgilerle örtüşmektedir?",
            "Metne göre aşağıdakilerden hangisi doğrudur?",
        ]
        medium_stems = [
            "Metindeki bilgilerden hareketle aşağıdaki çıkarımlardan hangisi yapılabilir?",
            "Aşağıdakilerden hangisi metindeki açıklamalarla tutarlıdır?",
            "Verilen bilgiler ışığında aşağıdakilerden hangisi doğru bir değerlendirmedir?",
        ]
        hard_stems = [
            "Metindeki bilgiler bir bütün olarak değerlendirildiğinde hangi yargıya ulaşılır?",
            "Aşağıdakilerden hangisi metindeki bilgilerle çelişmektedir?",
            "Metindeki kavramlar sentezlendiğinde hangi önerme geçerliliğini yitirir?",
        ]

    stem_map = {"easy": easy_stems, "medium": medium_stems, "hard": hard_stems}
    return random.choice(stem_map.get(level, medium_stems))


# ──────────────────────────────────────────────────────────────────────────────
# Gemini prompt — refactored (replaces old _generate_with_gemini prompt)
# ──────────────────────────────────────────────────────────────────────────────

# ★ Drop this constant in place of the old inline prompt string ★
GEMINI_SYSTEM_PROMPT = """\
Sen ölçme-değerlendirme uzmanı bir eğitim tasarımcısısın.
Görevin, aşağıda verilen metinden İÇERİĞE ÖZGÜ çoktan seçmeli sorular üretmektir.

## KESİN YASAKLAR — bu kalıpları ASLA kullanma:
- "Metne göre aşağıdakilerden hangisi doğrudur?"
- "Metnin ana fikri nedir?"
- "Metinde ele alınan konu hangisidir?"
- "Yazarın amacı nedir?"
- "Metindeki bilgilere göre hangisi doğrudur?"
- Her türlü "metne göre / pasaja göre / yazara göre" kalıbı
- Aynı soru kökünü 30 soru boyunca 2'den fazla tekrar etme

## HER SORU şu nitelikleri taşımalıdır:
1. KONU-BAĞLANTILI: Metindeki belirli bir terim, olay, formül, tarih, kişi veya mekanizma
   sorunun odağını oluşturmalı — soyut "doğru ifade" değil.
2. ÇELDİRİCİ KALİTESİ: Her yanlış şık, konuyu yüzeysel bilen birini yanıltacak kadar
   makul olmalı. Açıkça saçma şıklar kabul edilmez.
3. TEK DOĞRU CEVAP: Doğru şık tartışmasız doğru olmalı.

## ZORLUK TANIMLAMALARI:
KOLAY (ELO 700–900) — 10 soru:
  Metinde açıkça geçen tek bir olgu. Kim/Ne/Hangi yıl/Kaç sorularına benzer.
  Örnek: "Fotosentezde enerji kaynağı olarak ne kullanılır?"
  Çeldiriciler: yanlış ama ilgili kavramlar (CO₂, su, klorofil, güneş ışığı).

ORTA (ELO 950–1100) — 10 soru:
  İki bilgiyi ilişkilendirme veya kavramı yeni bağlama uygulama.
  Örnek: "X enzimi denatüre olduğunda Y süreci nasıl etkilenir?"
  Çeldiriciler: kısmen doğru ama eksik/yanlış mekanizma açıklamaları.

ZOR (ELO 1150–1400) — 10 soru:
  Sentez, istisna bulma veya çok adımlı çıkarım.
  Örnek: "Aşağıdakilerden hangisi X teorisiyle çelişen bir gözlemi ifade eder?"
  Çeldiriciler: kısmi bilgiye sahip birinin doğru sanabileceği ifadeler.

## KÖK ROTASYONU — 30 soru boyunca her kalıbı en fazla 3 kez kullan:
1. Tanım     → "[METİNDEKİ TERIM] aşağıdakilerden hangisiyle tanımlanır?"
2. Mekanizma → "[SÜREÇ] nasıl gerçekleşir?"
3. Neden-Sonuç → "[OLAY/DURUM]'un temel sonucu nedir?"
4. Uygulama  → "[KAVRAM] hangi durumda geçerlidir?"
5. Karşılaştırma → "[A] ile [B] arasındaki temel fark nedir?"
6. Sıralama  → "[X sürecinde] [ADIM]'ı hangi aşama izler?"
7. İstisna   → "Aşağıdakilerden hangisi [ÖZELLİK] taşımaz?"
8. Hesaplama → "[DEĞER] verildiğinde [SONUÇ] ne olur?" (sayısal içerik varsa)
9. Senaryo   → "Bir araştırmacı [ÖZGÜL SONUÇ]u gözlemlediğinde bunu en iyi hangi açıklama destekler?"
10. Çelişki  → "Aşağıdakilerden hangisi [KAVRAM/İDDİA] ile çelişir?"

## ÇIKTI FORMATI — SADECE geçerli JSON, markdown veya açıklama YOK:
{
  "questions": [
    {
      "id": 1,
      "difficulty": "easy",
      "stem_type": "definition",
      "question_text": "...",
      "options": {"A": "...", "B": "...", "C": "...", "D": "..."},
      "correct_answer": "B",
      "teacher_analysis": "B doğrudur çünkü... A yanlıştır çünkü... C ve D'nin neden elendiğini açıkla."
    }
  ]
}

Önce 10 KOLAY, sonra 10 ORTA, son olarak 10 ZOR soru üret. Toplam: 30 soru.
"""


def _generate_with_gemini(
    text: str,
    document_id: int,
    classroom_id: int,
    teacher_id: int,
    question_count: int,
) -> List:
    from app.models.db_models import Question
    from google.genai import types

    per_level = max(1, question_count // 3)

    # Inject the system prompt as a preamble + user turn
    user_message = (
        f"Aşağıdaki eğitim metninden tam olarak {per_level} kolay, "
        f"{per_level} orta ve {per_level} zor soru üret.\n\n"
        f"Her soru metindeki belirli bir terim, olgu veya mekanizmayı hedeflemelidir.\n\n"
        f"===METİN BAŞLANGICI===\n{text.strip()}\n===METİN SONU==="
    )

    full_prompt = GEMINI_SYSTEM_PROMPT + "\n\n" + user_message

    client = _get_gemini_client()
    response = client.models.generate_content(
        model="gemini-1.5-flash-8b",
        contents=full_prompt,
        config=types.GenerateContentConfig(
            temperature=0.35,       # lower = more factual, less hallucination
            max_output_tokens=12000,
            response_mime_type="application/json",
        ),
    )
    raw = response.text.strip()

    # Strip accidental markdown fences
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
    raw = raw.strip()

    parsed = json.loads(raw)
    questions_data: List[Dict[str, Any]] = (
        parsed["questions"] if isinstance(parsed, dict) and "questions" in parsed
        else parsed if isinstance(parsed, list)
        else []
    )

    difficulty_elo_map = {
        "easy":   lambda: random.randint(700, 900),
        "medium": lambda: random.randint(950, 1100),
        "hard":   lambda: random.randint(1150, 1400),
        "kolay":  lambda: random.randint(700, 900),
        "orta":   lambda: random.randint(950, 1100),
        "zor":    lambda: random.randint(1150, 1400),
    }

    db_questions = []
    for q in questions_data:
        if not isinstance(q, dict):
            continue

        q_text = (q.get("question_text") or q.get("text", "")).strip()
        if not q_text:
            continue

        options_raw = q.get("options", {})
        teacher_analysis = q.get("teacher_analysis")

        if isinstance(options_raw, dict):
            option_labels = ["A", "B", "C", "D"]
            options_list = [options_raw.get(k, "") for k in option_labels]
            correct_letter = str(q.get("correct_answer", "")).strip().upper()
            idx = {"A": 0, "B": 1, "C": 2, "D": 3}.get(correct_letter)
            if idx is None or not options_list[idx]:
                continue
            correct_answer_text = options_list[idx]
        elif isinstance(options_raw, list) and len(options_raw) == 4:
            options_list = [str(o).strip() for o in options_raw]
            correct_answer_text = str(q.get("correct_answer", "")).strip()
            if correct_answer_text not in options_list:
                continue
        else:
            continue

        difficulty = str(q.get("difficulty", "medium")).lower()
        elo_fn = difficulty_elo_map.get(difficulty, difficulty_elo_map["medium"])
        try:
            elo = int(q.get("elo_rating", 0)) or elo_fn()
            elo = max(700, min(1400, elo))
        except (ValueError, TypeError):
            elo = elo_fn()

        db_questions.append(
            Question(
                text=q_text,
                options=json.dumps(options_list, ensure_ascii=False),
                correct_answer=correct_answer_text,
                elo_rating=elo,
                classroom_id=classroom_id,
                document_id=document_id,
                created_by_teacher=teacher_id,
                is_approved=False,
                teacher_analysis=teacher_analysis,
            )
        )

    print(
        f"[Gemini] {len(db_questions)} soru üretildi (document_id={document_id}): "
        f"{sum(1 for q in db_questions if q.elo_rating <= 900)} kolay, "
        f"{sum(1 for q in db_questions if 900 < q.elo_rating <= 1100)} orta, "
        f"{sum(1 for q in db_questions if q.elo_rating > 1100)} zor"
    )
    return db_questions


# ──────────────────────────────────────────────────────────────────────────────
# Public entry point (unchanged signature)
# ──────────────────────────────────────────────────────────────────────────────

async def generate_questions_from_pdf(
    file_path: str,
    document_id: int,
    classroom_id: int,
    teacher_id: int,
    question_count: int = 30,
) -> Tuple[List, str]:
    """
    PDF dosyasından sorular üretir.
    Önce Gemini denenir; başarısız olursa dinamik yerel fallback kullanılır.
    """
    text = _extract_text_from_pdf(file_path)
    if not text.strip():
        print(f"[Gemini] PDF'den metin çıkarılamadı: {file_path}")
        return [], ""

    try:
        questions = _generate_with_gemini(
            text, document_id, classroom_id, teacher_id, question_count
        )
        if questions:
            return questions, text
        print(f"[Gemini] Boş yanıt alındı, yerel üretime geçiliyor (document_id={document_id})")
    except json.JSONDecodeError as e:
        print(f"[Gemini] JSON parse hatası, yerel üretime geçiliyor: {e}")
    except Exception as e:
        print(f"[Gemini] Soru üretim hatası, yerel üretime geçiliyor: {e}")

    fallback = generate_fallback_questions_from_text(
        text, document_id, classroom_id, teacher_id, question_count
    )
    return fallback, text