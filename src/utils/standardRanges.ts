// src/utils/standardRanges.ts

/**
 * Стандартные диапазоны для тестирования и дефолтных сценариев.
 * Формат: Строка с перечислением рук, понятная нашему парсеру.
 */

// 1. УНИВЕРСАЛЬНЫЙ ШИРОКИЙ (Top 50%)
// Используй это, если хочешь просто потыкать кнопки и чтобы любая нормальная рука работала.
// Включает все пары, весь бродвей, все одномастные тузы/короли/дамы и коннекторы.
export const RANGE_WIDE_50 = [
    // Pairs
    "22, 33, 44, 55, 66, 77, 88, 99, TT, JJ, QQ, KK, AA",
    // Suited Broadway & Aces
    "AKs, AQs, AJs, ATs, KQs, KJs, KTs, QJs, QTs, JTs",
    "A9s, A8s, A7s, A6s, A5s, A4s, A3s, A2s",
    "K9s, K8s, K7s, Q9s, J9s, T9s",
    // Offsuit Broadway
    "AKo, AQo, AJo, ATo, KQo, KJo, QJo",
    // Suited Connectors & Gappers
    "98s, 87s, 76s, 65s, 54s, 43s",
    "97s, 86s, 75s, 64s"
].join(", ");

// 2. OOP RIVER DEFENSE (CAPPED)
// Игрок без позиции, который чекал флоп и терн.
// У него НЕТ монстров (AA, KK, AK), иначе он бы рейзил раньше.
// У него много вторых пар и слабых топ-пар.
export const RANGE_OOP_CAPPED = [
    // Pocket Pairs (low to medium)
    "22, 33, 44, 55, 66, 77, 88, 99, TT, JJ",
    // Weak Top Pairs & Second Pairs
    "KQs, KJs, KTs, K9s",
    "QJs, QTs, Q9s",
    "JTs, J9s, T9s",
    // Missed Draws (Bluff catchers or folds)
    "A5s, A4s, A3s, A2s",
    "87s, 76s, 65s"
].join(", ");

// 3. IP RIVER AGGRESSION (POLARIZED)
// Агрессор в позиции. У него ИЛИ натсы (AA, Сеты), ИЛИ полный воздух (блефы).
export const RANGE_IP_POLARIZED = [
    // MONSTERS (Value)
    "AA, KK, QQ, JJ, TT, 99, 55, 22", // Sets & Overpairs
    "AKs, KQs, AQs", // Top Pairs Top Kicker
    "AKo",
    // BLUFFS (Missed draws, bottom range)
    "A5s, A4s, A3s, A2s", // Missed nut flush draws
    "J9s, T8s, 97s, 87s", // Missed straights
    "76s, 65s"
].join(", ");

/**
 * Хелпер, чтобы получить диапазон по типу
 */
export const getRangeByType = (type: 'wide' | 'oop' | 'ip') => {
    switch (type) {
        case 'oop': return RANGE_OOP_CAPPED;
        case 'ip': return RANGE_IP_POLARIZED;
        case 'wide':
        default: return RANGE_WIDE_50;
    }
};
