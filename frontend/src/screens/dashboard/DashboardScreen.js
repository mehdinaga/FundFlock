// src/screens/dashboard/DashboardScreen.js
//
// A single-screen financial dashboard that pulls expenses + settlements and
// visualises them three ways:
//
//   1. Spending by category (interactive donut)
//   2. Expense trend over time (interactive bar chart, auto-bucketing)
//   3. Settled vs outstanding (stacked bar + KPI pair)
//
// All aggregation happens client-side against the same endpoints the rest
// of the app already hits — no extra backend routes required. This keeps
// the dashboard a pure view and avoids a third source of truth for
// balances.
import React, {
    useCallback,
    useEffect,
    useMemo,
    useState,
} from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    RefreshControl,
    ActivityIndicator,
    SafeAreaView,
    Platform,
    StatusBar,
    Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, {
    G,
    Path,
    Rect,
    Circle,
    Line,
    Text as SvgText,
    Defs,
    LinearGradient,
    Stop,
} from 'react-native-svg';
import { useAuth } from '../../context/AuthContext';
import { getExpenses } from '../../api/expenses';
import { listSettlements } from '../../api/payments';

// ────────────────────────────────────────────────────────────────────────────
// Category taxonomy — mirrors the one used in ExpensesScreen so the dashboard
// and the expense feed visually agree. Legacy values fold into new ones.
// ────────────────────────────────────────────────────────────────────────────
const CATEGORIES = [
    { id: 'entertainment', label: 'Entertainment', color: '#8B5CF6', icon: 'game-controller-outline' },
    { id: 'food_drink', label: 'Food & Drink', color: '#F97316', icon: 'restaurant-outline' },
    { id: 'home', label: 'Home', color: '#10B981', icon: 'home-outline' },
    { id: 'life', label: 'Life', color: '#EC4899', icon: 'heart-outline' },
    { id: 'transportation', label: 'Transportation', color: '#3B82F6', icon: 'car-outline' },
    { id: 'utilities', label: 'Utilities', color: '#F59E0B', icon: 'flash-outline' },
    { id: 'general', label: 'General', color: '#737373', icon: 'pricetag-outline' },
];

const LEGACY_CATEGORY_MAP = {
    food: 'food_drink',
    transport: 'transportation',
    shopping: 'general',
    health: 'life',
    travel: 'transportation',
    education: 'life',
    other: 'general',
};

const resolveCategoryId = (raw) => {
    if (!raw) return 'general';
    if (LEGACY_CATEGORY_MAP[raw]) return LEGACY_CATEGORY_MAP[raw];
    const found = CATEGORIES.find((c) => c.id === raw);
    return found ? found.id : 'general';
};

const getCategoryMeta = (id) =>
    CATEGORIES.find((c) => c.id === id) || CATEGORIES[CATEGORIES.length - 1];

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────
const RANGES = [
    { id: '7d', label: '7D', days: 7 },
    { id: '1m', label: '1M', days: 30 },
    { id: '3m', label: '3M', days: 90 },
    { id: '1y', label: '1Y', days: 365 },
    { id: 'all', label: 'All', days: null },
];

const fmtMoney = (n) => {
    const abs = Math.abs(n || 0);
    if (abs >= 1000) return `£${(abs / 1000).toFixed(abs >= 10000 ? 0 : 1)}k`;
    return `£${abs.toFixed(2)}`;
};

const fmtMoneyFull = (n) => `£${(n || 0).toFixed(2)}`;

// Compact formatter used only by chart axes. Trims decimals on whole
// numbers so labels like "£225" fit in the narrow left gutter instead
// of clipping off as "£225.00".
const fmtAxis = (n) => {
    const abs = Math.abs(n || 0);
    if (abs >= 1000) return `£${(abs / 1000).toFixed(abs >= 10000 ? 0 : 1)}k`;
    if (abs === Math.floor(abs)) return `£${abs.toFixed(0)}`;
    return `£${abs.toFixed(2)}`;
};

// Returns how much `me` owes for their share of a single expense.
// paidBy===me means they already paid, so their "owed" share is 0.
const userShareForExpense = (exp, myId) => {
    if (!exp) return 0;
    const splits = exp.splits || [];
    const split = splits.find((s) => {
        const sid = s.user?._id?.toString?.() || s.user?.toString?.() || '';
        return sid === myId;
    });
    if (split) return Number(split.amount) || 0;

    // Fallback for equal splits stored without explicit amounts.
    const members = exp.members || [];
    if (members.length === 0) return 0;
    return (Number(exp.amount) || 0) / members.length;
};

const isMemberOf = (exp, myId) => {
    const members = exp.members || [];
    return members.some((m) => {
        const id = m?._id?.toString?.() || m?.toString?.() || '';
        return id === myId;
    });
};

// Build a d-string for an SVG donut-arc slice.
// cx/cy = centre, rOuter/rInner = radii, startAngle/endAngle in radians.
const arcPath = (cx, cy, rOuter, rInner, startAngle, endAngle) => {
    const large = endAngle - startAngle > Math.PI ? 1 : 0;
    const x1 = cx + rOuter * Math.cos(startAngle);
    const y1 = cy + rOuter * Math.sin(startAngle);
    const x2 = cx + rOuter * Math.cos(endAngle);
    const y2 = cy + rOuter * Math.sin(endAngle);
    const x3 = cx + rInner * Math.cos(endAngle);
    const y3 = cy + rInner * Math.sin(endAngle);
    const x4 = cx + rInner * Math.cos(startAngle);
    const y4 = cy + rInner * Math.sin(startAngle);
    return [
        `M ${x1} ${y1}`,
        `A ${rOuter} ${rOuter} 0 ${large} 1 ${x2} ${y2}`,
        `L ${x3} ${y3}`,
        `A ${rInner} ${rInner} 0 ${large} 0 ${x4} ${y4}`,
        'Z',
    ].join(' ');
};

const startOfDay = (d) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
};

// ISO-style week: weeks begin on Monday. getDay() returns 0=Sunday..6=Saturday,
// so the distance from Monday is `(day + 6) % 7` (Mon→0, Sun→6).
const startOfWeekMonday = (d) => {
    const x = startOfDay(d);
    const diff = (x.getDay() + 6) % 7;
    x.setDate(x.getDate() - diff);
    return x;
};

const startOfMonth = (d) => {
    const x = new Date(d.getFullYear(), d.getMonth(), 1);
    x.setHours(0, 0, 0, 0);
    return x;
};

// How many buckets to show per granularity. Chosen so the X-axis stays
// readable on typical phone widths without clipping labels.
const BUCKETS_PER_MODE = { day: 14, week: 8, month: 6 };

// Label formatters — short labels go on the X-axis under each bucket, full
// labels show up in tooltips and the selected-bucket detail panel.
const bucketLabels = {
    day: {
        short: (d) => d.toLocaleDateString(undefined, { weekday: 'short' }).charAt(0),
        full: (d) => d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
    },
    week: {
        short: (d) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        full: (start, end) => {
            const last = new Date(end);
            last.setDate(last.getDate() - 1);
            return `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${last.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
        },
    },
    month: {
        short: (d) => d.toLocaleDateString(undefined, { month: 'short' }),
        full: (d) => d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
    },
};

// ────────────────────────────────────────────────────────────────────────────
// Donut chart component
// ────────────────────────────────────────────────────────────────────────────
const Donut = ({ segments, total, selectedId, onSelect, centerLabel, centerValue }) => {
    const size = 220;
    const cx = size / 2;
    const cy = size / 2;
    const rOuter = size / 2 - 6;
    const rInner = rOuter - 36;

    const totalValue = segments.reduce((acc, s) => acc + s.value, 0);
    let angle = -Math.PI / 2;

    const slices = segments.map((seg) => {
        const frac = totalValue > 0 ? seg.value / totalValue : 0;
        const next = angle + frac * Math.PI * 2;
        const path = arcPath(cx, cy, rOuter, rInner, angle, next);
        const mid = (angle + next) / 2;
        const labelX = cx + (rOuter + rInner) / 2 * Math.cos(mid);
        const labelY = cy + (rOuter + rInner) / 2 * Math.sin(mid);
        const slice = {
            ...seg,
            path,
            startAngle: angle,
            endAngle: next,
            frac,
            labelX,
            labelY,
        };
        angle = next;
        return slice;
    });

    // When nothing has been spent yet we still want a visible ring so the
    // widget doesn't collapse into empty space.
    const emptyRing = totalValue === 0;

    return (
        <View style={{ alignItems: 'center' }}>
            <Svg width={size} height={size}>
                {emptyRing ? (
                    <Circle
                        cx={cx}
                        cy={cy}
                        r={(rOuter + rInner) / 2}
                        stroke="#F0F0F0"
                        strokeWidth={rOuter - rInner}
                        fill="none"
                    />
                ) : (
                    <G>
                        {slices.map((s) => {
                            const isSelected = selectedId === s.id;
                            const dimmed = selectedId && !isSelected;
                            return (
                                <Path
                                    key={s.id}
                                    d={s.path}
                                    fill={s.color}
                                    opacity={dimmed ? 0.25 : 1}
                                    onPress={() => onSelect?.(isSelected ? null : s.id)}
                                />
                            );
                        })}
                    </G>
                )}
                <SvgText
                    x={cx}
                    y={cy - 4}
                    fontSize={12}
                    fill="#737373"
                    textAnchor="middle"
                >
                    {centerLabel}
                </SvgText>
                <SvgText
                    x={cx}
                    y={cy + 18}
                    fontSize={22}
                    fontWeight="800"
                    fill="#171717"
                    textAnchor="middle"
                >
                    {centerValue}
                </SvgText>
            </Svg>
        </View>
    );
};

// ────────────────────────────────────────────────────────────────────────────
// Line chart component (trend)
//
// Renders a full detail chart:
//   - 4-line Y-axis with money-formatted labels
//   - X-axis tick labels underneath
//   - Area fill under the curve (orange gradient)
//   - Line stroke + dots at every data point
//   - A dashed average line across the chart
//   - Tap anywhere along the X axis to snap-select the closest point —
//     the selected dot grows and a floating tooltip pops above it showing
//     the bucket label and formatted value.
// ────────────────────────────────────────────────────────────────────────────
const LineChart = ({ buckets, selectedIdx, onSelectIdx, height = 220 }) => {
    const screenW = Dimensions.get('window').width;
    const width = Math.max(280, screenW - 64);
    const padTop = 28;
    const padBottom = 8;
    // Left gutter is wide enough for labels like "£1.2k" without clipping
    // the leading "£"; right gutter gives the last dot breathing room so
    // it isn't flush against the chart edge.
    const padLeft = 54;
    const padRight = 22;
    const innerW = width - padLeft - padRight;
    const innerH = height - padTop - padBottom;

    // Compute a "nice" max that rounds up to a clean number so the axis
    // labels read like $50 / $100 instead of $48.23.
    const rawMax = Math.max(1, ...buckets.map((b) => b.value));
    const niceMax = (() => {
        if (rawMax <= 10) return Math.ceil(rawMax);
        const pow = Math.pow(10, Math.floor(Math.log10(rawMax)));
        const n = Math.ceil(rawMax / pow) * pow;
        // One more step of headroom so the top dot isn't flush with the edge.
        return n < rawMax * 1.1 ? n + pow / 2 : n;
    })();

    const avg = buckets.length
        ? buckets.reduce((a, b) => a + b.value, 0) / buckets.length
        : 0;

    const gridLines = 4;

    // X-coordinate for bucket i. Single-point charts get centred instead
    // of collapsed against the left gutter.
    const xFor = (i) => {
        if (buckets.length <= 1) return padLeft + innerW / 2;
        return padLeft + (innerW / (buckets.length - 1)) * i;
    };
    const yFor = (v) => padTop + innerH - (v / (niceMax || 1)) * innerH;

    // Build path strings. We use straight line segments here — smoother
    // curves look pretty but hide the actual data, which isn't what the
    // user asked for ("I want a line chart with everything detailed").
    let linePath = '';
    let areaPath = '';
    buckets.forEach((b, i) => {
        const x = xFor(i);
        const y = yFor(b.value);
        linePath += `${i === 0 ? 'M' : 'L'} ${x} ${y} `;
    });
    if (buckets.length > 0) {
        const firstX = xFor(0);
        const lastX = xFor(buckets.length - 1);
        const baseY = padTop + innerH;
        areaPath = `M ${firstX} ${baseY} ` +
            buckets.map((b, i) => `L ${xFor(i)} ${yFor(b.value)} `).join('') +
            `L ${lastX} ${baseY} Z`;
    }

    // Y-axis tick labels.
    const yTicks = [];
    for (let i = 0; i <= gridLines; i++) {
        const v = (niceMax / gridLines) * (gridLines - i);
        const y = padTop + (innerH / gridLines) * i;
        yTicks.push({ v, y });
    }

    // Selected dot, tooltip positioning.
    const selBucket = selectedIdx != null ? buckets[selectedIdx] : null;
    const selX = selBucket ? xFor(selectedIdx) : null;
    const selY = selBucket ? yFor(selBucket.value) : null;

    // Clamp tooltip to the visible chart so it doesn't clip at the edges.
    const tooltipW = 104;
    const tooltipH = 42;
    let tipX = selX != null ? selX - tooltipW / 2 : 0;
    if (tipX < padLeft) tipX = padLeft;
    if (tipX + tooltipW > padLeft + innerW) tipX = padLeft + innerW - tooltipW;
    let tipY = selY != null ? selY - tooltipH - 10 : 0;
    if (tipY < 2) tipY = (selY || 0) + 12; // flip below if no room above

    return (
        <Svg width={width} height={height}>
            <Defs>
                <LinearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0%" stopColor="#F97316" stopOpacity="0.35" />
                    <Stop offset="100%" stopColor="#F97316" stopOpacity="0.02" />
                </LinearGradient>
            </Defs>

            {/* Y-axis grid + tick labels */}
            {yTicks.map((t, i) => (
                <G key={`yt-${i}`}>
                    <Line
                        x1={padLeft}
                        y1={t.y}
                        x2={padLeft + innerW}
                        y2={t.y}
                        stroke="#F0F0F0"
                        strokeWidth={1}
                    />
                    <SvgText
                        x={padLeft - 6}
                        y={t.y + 4}
                        fontSize={10}
                        fill="#A3A3A3"
                        textAnchor="end"
                    >
                        {fmtAxis(t.v)}
                    </SvgText>
                </G>
            ))}

            {/* Average reference line */}
            {avg > 0 && (
                <G>
                    <Line
                        x1={padLeft}
                        y1={yFor(avg)}
                        x2={padLeft + innerW}
                        y2={yFor(avg)}
                        stroke="#A3A3A3"
                        strokeWidth={1}
                        strokeDasharray="4 4"
                    />
                    {/* Pin the avg label to the left end of the dashed line
                        so it never collides with the final data dot on the
                        right edge (which tends to be the peak value). */}
                    <SvgText
                        x={padLeft + 4}
                        y={yFor(avg) - 4}
                        fontSize={9}
                        fontWeight="600"
                        fill="#737373"
                        textAnchor="start"
                    >
                        avg {fmtAxis(avg)}
                    </SvgText>
                </G>
            )}

            {/* Area fill */}
            {buckets.length > 1 && areaPath ? (
                <Path d={areaPath} fill="url(#trendGrad)" />
            ) : null}

            {/* Main line */}
            {buckets.length > 1 ? (
                <Path
                    d={linePath}
                    stroke="#F97316"
                    strokeWidth={2.5}
                    fill="none"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                />
            ) : null}

            {/* Data point dots */}
            {buckets.map((b, i) => {
                const cx = xFor(i);
                const cy = yFor(b.value);
                const isSel = selectedIdx === i;
                return (
                    <G key={`dot-${i}`}>
                        <Circle
                            cx={cx}
                            cy={cy}
                            r={isSel ? 6 : 3}
                            fill={isSel ? '#F97316' : '#FFFFFF'}
                            stroke="#F97316"
                            strokeWidth={2}
                        />
                    </G>
                );
            })}

            {/* Invisible vertical columns, one per bucket, for easier tapping.
                Rendered last so they sit on top of the line and dots. */}
            {buckets.map((b, i) => {
                const columnW = innerW / Math.max(1, buckets.length);
                const cx = xFor(i);
                return (
                    <Rect
                        key={`hit-${i}`}
                        x={cx - columnW / 2}
                        y={padTop}
                        width={columnW}
                        height={innerH}
                        fill="transparent"
                        onPress={() => onSelectIdx?.(selectedIdx === i ? null : i)}
                    />
                );
            })}

            {/* Tooltip + crosshair for selected point */}
            {selBucket && (
                <G>
                    <Line
                        x1={selX}
                        y1={padTop}
                        x2={selX}
                        y2={padTop + innerH}
                        stroke="#F97316"
                        strokeWidth={1}
                        strokeDasharray="3 3"
                        opacity={0.6}
                    />
                    <Rect
                        x={tipX}
                        y={tipY}
                        width={tooltipW}
                        height={tooltipH}
                        rx={8}
                        fill="#171717"
                    />
                    <SvgText
                        x={tipX + tooltipW / 2}
                        y={tipY + 16}
                        fontSize={10}
                        fill="#A3A3A3"
                        textAnchor="middle"
                    >
                        {selBucket.label}
                    </SvgText>
                    <SvgText
                        x={tipX + tooltipW / 2}
                        y={tipY + 32}
                        fontSize={13}
                        fontWeight="800"
                        fill="#FFFFFF"
                        textAnchor="middle"
                    >
                        {fmtMoneyFull(selBucket.value)}
                    </SvgText>
                </G>
            )}
        </Svg>
    );
};

// ────────────────────────────────────────────────────────────────────────────
// BucketDetail — rich panel describing whichever bucket is currently in
// focus. Always visible so the chart isn't the only source of information.
// Shows per-bucket total, expense count, top category and the top few
// expenses in that bucket (sorted by this user's share, desc).
// ────────────────────────────────────────────────────────────────────────────
const BucketDetail = ({ bucket, mode, isExplicit, onClear }) => {
    if (!bucket) return null;

    const topCat = Object.entries(bucket.categoryTotals || {})
        .sort((a, b) => b[1] - a[1])[0];
    const topCatMeta = topCat ? getCategoryMeta(topCat[0]) : null;
    const topExpenses = (bucket.expenses || []).slice(0, 3);
    const avg = bucket.count ? bucket.value / bucket.count : 0;

    const modeNoun = mode === 'day' ? 'day' : mode === 'week' ? 'week' : 'month';

    return (
        <View style={styles.bucketPanel}>
            <View style={styles.bucketPanelHeader}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.bucketPanelEyebrow}>
                        {isExplicit ? `Selected ${modeNoun}` : `Most recent ${modeNoun}`}
                    </Text>
                    <Text style={styles.bucketPanelTitle}>{bucket.fullLabel}</Text>
                </View>
                {onClear && (
                    <TouchableOpacity onPress={onClear} style={styles.clearBtn}>
                        <Ionicons name="close" size={14} color="#737373" />
                    </TouchableOpacity>
                )}
            </View>

            <View style={styles.bucketMiniStats}>
                <View style={styles.bucketMiniStat}>
                    <Text style={styles.bucketMiniLabel}>Total</Text>
                    <Text style={[styles.bucketMiniValue, { color: '#F97316' }]}>
                        {fmtMoneyFull(bucket.value)}
                    </Text>
                </View>
                <View style={styles.bucketMiniStat}>
                    <Text style={styles.bucketMiniLabel}>Expenses</Text>
                    <Text style={styles.bucketMiniValue}>{bucket.count}</Text>
                </View>
                <View style={styles.bucketMiniStat}>
                    <Text style={styles.bucketMiniLabel}>Avg / item</Text>
                    <Text style={styles.bucketMiniValue}>{fmtMoneyFull(avg)}</Text>
                </View>
            </View>

            {topCat ? (
                <View style={styles.topCatRow}>
                    <View
                        style={[
                            styles.topCatDot,
                            { backgroundColor: topCatMeta.color },
                        ]}
                    />
                    <Text style={styles.topCatLabel}>
                        Top category ·{' '}
                        <Text style={styles.topCatName}>{topCatMeta.label}</Text>
                    </Text>
                    <Text style={styles.topCatValue}>{fmtMoneyFull(topCat[1])}</Text>
                </View>
            ) : (
                <Text style={styles.bucketEmpty}>
                    No expenses recorded in this {modeNoun}.
                </Text>
            )}

            {topExpenses.length > 0 && (
                <View style={styles.expenseList}>
                    {topExpenses.map((e) => {
                        const meta = getCategoryMeta(e.category);
                        return (
                            <View key={e.id} style={styles.expenseItem}>
                                <View
                                    style={[
                                        styles.expenseIcon,
                                        { backgroundColor: meta.color + '22' },
                                    ]}
                                >
                                    <Ionicons
                                        name={meta.icon}
                                        size={14}
                                        color={meta.color}
                                    />
                                </View>
                                <Text
                                    style={styles.expenseTitle}
                                    numberOfLines={1}
                                >
                                    {e.title}
                                </Text>
                                <Text style={styles.expenseAmount}>
                                    {fmtMoneyFull(e.amount)}
                                </Text>
                            </View>
                        );
                    })}
                    {bucket.expenses.length > topExpenses.length && (
                        <Text style={styles.expenseMore}>
                            +{bucket.expenses.length - topExpenses.length} more
                        </Text>
                    )}
                </View>
            )}
        </View>
    );
};

// ────────────────────────────────────────────────────────────────────────────
// Trend stats — small card row with peak / avg / total so the chart isn't
// the only source of information. Nothing magical, just annotates what the
// line is telling you.
// ────────────────────────────────────────────────────────────────────────────
const TrendStats = ({ buckets }) => {
    const total = buckets.reduce((a, b) => a + b.value, 0);
    const peak = buckets.reduce(
        (best, b) => (b.value > best.value ? b : best),
        { label: '—', value: 0 }
    );
    const avg = buckets.length ? total / buckets.length : 0;
    const nonZero = buckets.filter((b) => b.value > 0).length;

    return (
        <View style={styles.trendStatsRow}>
            <View style={styles.trendStat}>
                <Text style={styles.trendStatLabel}>Total</Text>
                <Text style={styles.trendStatValue}>{fmtMoneyFull(total)}</Text>
            </View>
            <View style={styles.trendStatDivider} />
            <View style={styles.trendStat}>
                <Text style={styles.trendStatLabel}>Average</Text>
                <Text style={styles.trendStatValue}>{fmtMoneyFull(avg)}</Text>
                <Text style={styles.trendStatSub}>per bucket</Text>
            </View>
            <View style={styles.trendStatDivider} />
            <View style={styles.trendStat}>
                <Text style={styles.trendStatLabel}>Peak</Text>
                <Text style={styles.trendStatValue}>{fmtMoneyFull(peak.value)}</Text>
                <Text style={styles.trendStatSub} numberOfLines={1}>
                    {peak.value > 0 ? peak.label : '—'}
                </Text>
            </View>
            <View style={styles.trendStatDivider} />
            <View style={styles.trendStat}>
                <Text style={styles.trendStatLabel}>Active</Text>
                <Text style={styles.trendStatValue}>
                    {nonZero}/{buckets.length}
                </Text>
                <Text style={styles.trendStatSub}>with spend</Text>
            </View>
        </View>
    );
};

// ────────────────────────────────────────────────────────────────────────────
// Main component
// ────────────────────────────────────────────────────────────────────────────
const DashboardScreen = ({ onOpenNotifications, unreadCount = 0 }) => {
    const { user } = useAuth();
    const myId = user?._id?.toString();

    const [expenses, setExpenses] = useState([]);
    const [settlements, setSettlements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [rangeId, setRangeId] = useState('1m');
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [selectedBarIdx, setSelectedBarIdx] = useState(null);

    // Trend-chart controls — granularity plus an "anchor" that marks the
    // most recent bucket in the visible window. prev/next step the anchor
    // by a full window, so scrubbing feels like paging through history.
    const [trendMode, setTrendMode] = useState('day'); // 'day' | 'week' | 'month'
    const [trendAnchor, setTrendAnchor] = useState(() => new Date());

    const load = useCallback(async () => {
        try {
            const [expRes, settleRes] = await Promise.all([
                getExpenses(),
                listSettlements().catch(() => ({ data: [] })),
            ]);
            setExpenses(Array.isArray(expRes?.data) ? expRes.data : []);
            setSettlements(Array.isArray(settleRes?.data) ? settleRes.data : []);
        } catch (err) {
            // eslint-disable-next-line no-console
            console.log('Dashboard load failed', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        load();
    }, [load]);

    const range = RANGES.find((r) => r.id === rangeId) || RANGES[1];

    // ── Filter expenses to the range and the current user ─────────────────
    const rangeStart = useMemo(() => {
        if (range.days == null) return new Date(0);
        const d = new Date();
        d.setDate(d.getDate() - range.days);
        return d;
    }, [range]);

    const myExpensesInRange = useMemo(() => {
        return expenses.filter((e) => {
            if (!isMemberOf(e, myId)) return false;
            const when = e.expenseDate || e.createdAt;
            if (!when) return true;
            return new Date(when) >= rangeStart;
        });
    }, [expenses, myId, rangeStart]);

    // ── Chart 1: Spending by category (user's share) ─────────────────────
    const categorySegments = useMemo(() => {
        const bucket = Object.fromEntries(CATEGORIES.map((c) => [c.id, 0]));
        for (const e of myExpensesInRange) {
            const cid = resolveCategoryId(e.category);
            bucket[cid] = (bucket[cid] || 0) + userShareForExpense(e, myId);
        }
        return CATEGORIES.map((c) => ({
            id: c.id,
            label: c.label,
            color: c.color,
            icon: c.icon,
            value: Math.round((bucket[c.id] || 0) * 100) / 100,
        })).filter((s) => s.value > 0.0049)
            .sort((a, b) => b.value - a.value);
    }, [myExpensesInRange, myId]);

    const totalSpent = useMemo(
        () => categorySegments.reduce((a, s) => a + s.value, 0),
        [categorySegments]
    );

    const activeCategory = useMemo(
        () => categorySegments.find((s) => s.id === selectedCategory) || null,
        [categorySegments, selectedCategory]
    );

    // ── Chart 2: Spending trend over time ────────────────────────────────
    //
    // Builds a fixed-size window of buckets ending at `trendAnchor` in the
    // chosen granularity. Every bucket carries its own per-category totals
    // plus a sorted `topExpenses` list so the selected-bucket detail panel
    // below the chart always has rich information to display.
    const trendBuckets = useMemo(() => {
        const n = BUCKETS_PER_MODE[trendMode];
        const anchor = new Date(trendAnchor);
        const out = [];

        if (trendMode === 'day') {
            const anchorStart = startOfDay(anchor);
            for (let i = n - 1; i >= 0; i--) {
                const start = new Date(anchorStart);
                start.setDate(start.getDate() - i);
                const end = new Date(start);
                end.setDate(end.getDate() + 1);
                out.push({
                    start,
                    end,
                    label: bucketLabels.day.short(start),
                    fullLabel: bucketLabels.day.full(start),
                    value: 0,
                    count: 0,
                    categoryTotals: {},
                    expenses: [],
                });
            }
        } else if (trendMode === 'week') {
            const anchorWeek = startOfWeekMonday(anchor);
            for (let i = n - 1; i >= 0; i--) {
                const start = new Date(anchorWeek);
                start.setDate(start.getDate() - i * 7);
                const end = new Date(start);
                end.setDate(end.getDate() + 7);
                out.push({
                    start,
                    end,
                    label: bucketLabels.week.short(start),
                    fullLabel: bucketLabels.week.full(start, end),
                    value: 0,
                    count: 0,
                    categoryTotals: {},
                    expenses: [],
                });
            }
        } else {
            const anchorMonth = startOfMonth(anchor);
            for (let i = n - 1; i >= 0; i--) {
                const start = new Date(
                    anchorMonth.getFullYear(),
                    anchorMonth.getMonth() - i,
                    1
                );
                const end = new Date(
                    start.getFullYear(),
                    start.getMonth() + 1,
                    1
                );
                out.push({
                    start,
                    end,
                    label: bucketLabels.month.short(start),
                    fullLabel: bucketLabels.month.full(start),
                    value: 0,
                    count: 0,
                    categoryTotals: {},
                    expenses: [],
                });
            }
        }

        const windowStart = out[0]?.start;
        const windowEnd = out[out.length - 1]?.end;

        for (const e of expenses) {
            if (!isMemberOf(e, myId)) continue;
            const when = new Date(e.expenseDate || e.createdAt);
            if (!windowStart || when < windowStart || when >= windowEnd) continue;
            const share = userShareForExpense(e, myId);
            if (share <= 0) continue;
            for (const b of out) {
                if (when >= b.start && when < b.end) {
                    b.value += share;
                    b.count += 1;
                    const cid = resolveCategoryId(e.category);
                    b.categoryTotals[cid] = (b.categoryTotals[cid] || 0) + share;
                    b.expenses.push({
                        id: e._id,
                        title: e.title,
                        amount: share,
                        category: cid,
                    });
                    break;
                }
            }
        }

        return out.map((b) => ({
            ...b,
            value: Math.round(b.value * 100) / 100,
            expenses: b.expenses
                .sort((a, x) => x.amount - a.amount),
        }));
    }, [expenses, myId, trendMode, trendAnchor]);

    const trendTotal = useMemo(
        () => trendBuckets.reduce((a, b) => a + b.value, 0),
        [trendBuckets]
    );

    // When anything about the window changes (mode, anchor), invalidate the
    // on-chart selection so we don't highlight a bucket that no longer
    // exists at that index.
    useEffect(() => {
        setSelectedBarIdx(null);
    }, [trendMode, trendAnchor]);

    const activeBucket = selectedBarIdx != null ? trendBuckets[selectedBarIdx] : null;

    // "Focus" is the bucket the detail panel describes: either the one the
    // user explicitly selected, or the most recent bucket in the window.
    // This means there's always a detail panel worth of info visible, even
    // before the user taps anything.
    const focusBucket = activeBucket
        || trendBuckets[trendBuckets.length - 1]
        || null;

    // Window label for the prev/next navigator — covers the whole visible
    // range rather than a single bucket.
    const windowLabel = useMemo(() => {
        if (!trendBuckets.length) return '';
        const first = trendBuckets[0];
        const last = trendBuckets[trendBuckets.length - 1];
        if (trendMode === 'month') {
            return `${bucketLabels.month.full(first.start)} – ${bucketLabels.month.full(last.start)}`;
        }
        const endInclusive = new Date(last.end);
        endInclusive.setDate(endInclusive.getDate() - 1);
        const sameYear = first.start.getFullYear() === endInclusive.getFullYear();
        const leftFmt = sameYear
            ? { month: 'short', day: 'numeric' }
            : { month: 'short', day: 'numeric', year: 'numeric' };
        return `${first.start.toLocaleDateString(undefined, leftFmt)} – ${endInclusive.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }, [trendBuckets, trendMode]);

    const shiftAnchor = (direction) => {
        setTrendAnchor((prev) => {
            const d = new Date(prev);
            const n = BUCKETS_PER_MODE[trendMode];
            if (trendMode === 'day') d.setDate(d.getDate() + direction * n);
            else if (trendMode === 'week') d.setDate(d.getDate() + direction * n * 7);
            else d.setMonth(d.getMonth() + direction * n);
            return d;
        });
    };

    // Can we move forward? Only if the current window doesn't already include
    // today — no point showing buckets in the future.
    const canStepForward = useMemo(() => {
        if (!trendBuckets.length) return false;
        const last = trendBuckets[trendBuckets.length - 1];
        return new Date() >= last.end;
    }, [trendBuckets]);

    // ── Chart 3: Settled vs pending ──────────────────────────────────────
    const settlementStats = useMemo(() => {
        let settledSent = 0;
        let settledReceived = 0;
        let pendingOut = 0; // not super critical — we don't have a pending "to-pay" number
        for (const s of settlements) {
            const isPayer = s.payer?._id?.toString?.() === myId;
            if (s.status === 'succeeded') {
                if (isPayer) settledSent += (s.amount || 0) / 100;
                else settledReceived += (s.amount || 0) / 100;
            } else if (['pending', 'processing'].includes(s.status)) {
                if (isPayer) pendingOut += (s.amount || 0) / 100;
            }
        }

        // Compute net balance per counterparty (same logic as ExpensesScreen).
        // This prevents a payment to one friend from zeroing out debts to others.
        const netPerPerson = {}; // friendId -> net dollars (positive = they owe me, negative = I owe them)
        const bump = (id, delta) => { netPerPerson[id] = (netPerPerson[id] || 0) + delta; };

        for (const e of expenses) {
            const payerId = e.paidBy?._id?.toString?.() || e.paidBy?.toString?.() || '';
            if (!payerId) continue;
            for (const sp of e.splits || []) {
                const uid = sp.user?._id?.toString?.() || sp.user?.toString?.() || '';
                if (!uid) continue;
                const share = Number(sp.amount) || 0;
                if (payerId === myId && uid !== myId) bump(uid, +share);
                else if (uid === myId && payerId !== myId) bump(payerId, -share);
            }
        }
        for (const s of settlements) {
            if (s.status !== 'succeeded' && s.status !== 'processing') continue;
            const pId = s.payer?._id?.toString?.() || s.payer?.toString?.() || '';
            const rId = s.recipient?._id?.toString?.() || s.recipient?.toString?.() || '';
            const dollars = (s.amount || 0) / 100;
            if (pId === myId && rId) bump(rId, +dollars);
            else if (rId === myId && pId) bump(pId, -dollars);
        }

        let outstandingOwed = 0;
        let outstandingOwing = 0;
        for (const v of Object.values(netPerPerson)) {
            if (v < -0.004) outstandingOwed += -v;
            else if (v > 0.004) outstandingOwing += v;
        }
        outstandingOwed = Math.round(outstandingOwed * 100) / 100;
        outstandingOwing = Math.round(outstandingOwing * 100) / 100;

        return {
            settledSent,
            settledReceived,
            outstandingOwed,
            outstandingOwing,
            pendingOut,
            totalSettled: settledSent + settledReceived,
            totalOutstanding: outstandingOwed + outstandingOwing,
        };
    }, [settlements, expenses, myId]);

    // ── Top-of-screen KPIs ───────────────────────────────────────────────
    const kpis = useMemo(() => {
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        let monthSpent = 0;
        for (const e of expenses) {
            if (!isMemberOf(e, myId)) continue;
            const when = new Date(e.expenseDate || e.createdAt);
            if (when >= monthStart) monthSpent += userShareForExpense(e, myId);
        }

        let monthSettled = 0;
        for (const s of settlements) {
            if (s.status !== 'succeeded') continue;
            const when = new Date(s.completedAt || s.createdAt);
            if (when >= monthStart) monthSettled += (s.amount || 0) / 100;
        }

        return {
            monthSpent,
            monthSettled,
            owed: settlementStats.outstandingOwed,
            owing: settlementStats.outstandingOwing,
        };
    }, [expenses, settlements, myId, settlementStats]);

    // ─────────────────────────────────────────────────────────────────────
    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.centered}>
                    <ActivityIndicator color="#F97316" />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            {/* Header — matches Groups / Expenses for visual parity */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Dashboard</Text>
                <TouchableOpacity
                    onPress={onOpenNotifications}
                    style={styles.bell}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                    <Ionicons name="notifications-outline" size={22} color="#171717" />
                    {unreadCount > 0 && (
                        <View style={styles.bellBadge}>
                            <Text style={styles.bellBadgeText}>
                                {unreadCount > 9 ? '9+' : unreadCount}
                            </Text>
                        </View>
                    )}
                </TouchableOpacity>
            </View>

            <ScrollView
                contentContainerStyle={styles.scrollBody}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor="#F97316"
                    />
                }
                showsVerticalScrollIndicator={false}
            >
                {/* KPI grid */}
                <View style={styles.kpiGrid}>
                    <View style={[styles.kpiCard, { backgroundColor: '#FFF7ED' }]}>
                        <Ionicons name="trending-up" size={18} color="#F97316" />
                        <Text style={styles.kpiLabel}>This month</Text>
                        <Text style={[styles.kpiValue, { color: '#F97316' }]}>
                            {fmtMoneyFull(kpis.monthSpent)}
                        </Text>
                        <Text style={styles.kpiSub}>your share of expenses</Text>
                    </View>
                    <View style={[styles.kpiCard, { backgroundColor: '#FEE2E2' }]}>
                        <Ionicons name="arrow-up" size={18} color="#EF4444" />
                        <Text style={styles.kpiLabel}>You owe</Text>
                        <Text style={[styles.kpiValue, { color: '#EF4444' }]}>
                            {fmtMoneyFull(kpis.owed)}
                        </Text>
                        <Text style={styles.kpiSub}>outstanding</Text>
                    </View>
                    <View style={[styles.kpiCard, { backgroundColor: '#D1FAE5' }]}>
                        <Ionicons name="arrow-down" size={18} color="#10B981" />
                        <Text style={styles.kpiLabel}>You're owed</Text>
                        <Text style={[styles.kpiValue, { color: '#10B981' }]}>
                            {fmtMoneyFull(kpis.owing)}
                        </Text>
                        <Text style={styles.kpiSub}>outstanding</Text>
                    </View>
                    <View style={[styles.kpiCard, { backgroundColor: '#EEF2FF' }]}>
                        <Ionicons name="checkmark-done" size={18} color="#6366F1" />
                        <Text style={styles.kpiLabel}>Settled</Text>
                        <Text style={[styles.kpiValue, { color: '#6366F1' }]}>
                            {fmtMoneyFull(kpis.monthSettled)}
                        </Text>
                        <Text style={styles.kpiSub}>this month</Text>
                    </View>
                </View>

                {/* Range selector */}
                <View style={styles.rangeRow}>
                    {RANGES.map((r) => (
                        <TouchableOpacity
                            key={r.id}
                            style={[
                                styles.rangePill,
                                rangeId === r.id && styles.rangePillActive,
                            ]}
                            onPress={() => {
                                setRangeId(r.id);
                                setSelectedBarIdx(null);
                            }}
                        >
                            <Text
                                style={[
                                    styles.rangeText,
                                    rangeId === r.id && styles.rangeTextActive,
                                ]}
                            >
                                {r.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* Chart 1: Spending by category */}
                <View style={styles.chartCard}>
                    <View style={styles.chartHeader}>
                        <View>
                            <Text style={styles.chartTitle}>Spending by category</Text>
                            <Text style={styles.chartSub}>
                                {categorySegments.length} categories · {range.label}
                            </Text>
                        </View>
                        {activeCategory && (
                            <TouchableOpacity
                                style={styles.clearBtn}
                                onPress={() => setSelectedCategory(null)}
                            >
                                <Ionicons name="close" size={14} color="#737373" />
                            </TouchableOpacity>
                        )}
                    </View>

                    <Donut
                        segments={categorySegments}
                        total={totalSpent}
                        selectedId={selectedCategory}
                        onSelect={setSelectedCategory}
                        centerLabel={activeCategory ? activeCategory.label : 'Total'}
                        centerValue={
                            activeCategory
                                ? fmtMoney(activeCategory.value)
                                : fmtMoney(totalSpent)
                        }
                    />

                    {categorySegments.length === 0 ? (
                        <Text style={styles.noData}>
                            No expenses in this period yet.
                        </Text>
                    ) : (
                        <View style={styles.legend}>
                            {categorySegments.map((s) => {
                                const pct = totalSpent > 0
                                    ? Math.round((s.value / totalSpent) * 100)
                                    : 0;
                                const isSel = selectedCategory === s.id;
                                return (
                                    <TouchableOpacity
                                        key={s.id}
                                        style={[
                                            styles.legendRow,
                                            isSel && styles.legendRowActive,
                                        ]}
                                        onPress={() =>
                                            setSelectedCategory(isSel ? null : s.id)
                                        }
                                        activeOpacity={0.7}
                                    >
                                        <View
                                            style={[
                                                styles.legendDot,
                                                { backgroundColor: s.color },
                                            ]}
                                        />
                                        <Text style={styles.legendLabel}>{s.label}</Text>
                                        <Text style={styles.legendPct}>{pct}%</Text>
                                        <Text style={styles.legendValue}>
                                            {fmtMoneyFull(s.value)}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    )}
                </View>

                {/* Chart 2: Trend over time */}
                <View style={styles.chartCard}>
                    <View style={styles.chartHeader}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.chartTitle}>Expense trend</Text>
                            <Text style={styles.chartSub}>
                                {fmtMoneyFull(trendTotal)} total · {windowLabel}
                            </Text>
                        </View>
                    </View>

                    {/* Granularity segmented control — day / week / month.
                        Week always starts on Monday (see startOfWeekMonday). */}
                    <View style={styles.segmented}>
                        {[
                            { id: 'day', label: 'Daily' },
                            { id: 'week', label: 'Weekly' },
                            { id: 'month', label: 'Monthly' },
                        ].map((m) => (
                            <TouchableOpacity
                                key={m.id}
                                style={[
                                    styles.segment,
                                    trendMode === m.id && styles.segmentActive,
                                ]}
                                onPress={() => setTrendMode(m.id)}
                            >
                                <Text
                                    style={[
                                        styles.segmentText,
                                        trendMode === m.id && styles.segmentTextActive,
                                    ]}
                                >
                                    {m.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Window navigator — step the anchor a full window back
                        or forward. "Today" resets to the most recent window. */}
                    <View style={styles.navRow}>
                        <TouchableOpacity
                            onPress={() => shiftAnchor(-1)}
                            style={styles.navBtn}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                            <Ionicons name="chevron-back" size={18} color="#404040" />
                        </TouchableOpacity>
                        <View style={styles.navCenter}>
                            <Text style={styles.navLabel} numberOfLines={1}>
                                {windowLabel}
                            </Text>
                            {!canStepForward && (
                                <TouchableOpacity
                                    onPress={() => setTrendAnchor(new Date())}
                                    style={styles.todayChip}
                                >
                                    <Text style={styles.todayChipText}>Today</Text>
                                </TouchableOpacity>
                            )}
                            {canStepForward && (
                                <TouchableOpacity
                                    onPress={() => setTrendAnchor(new Date())}
                                    style={styles.todayChip}
                                >
                                    <Ionicons name="refresh" size={11} color="#F97316" />
                                    <Text style={styles.todayChipText}>Jump to today</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                        <TouchableOpacity
                            onPress={() => shiftAnchor(1)}
                            style={[styles.navBtn, !canStepForward && styles.navBtnDisabled]}
                            disabled={!canStepForward}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                            <Ionicons
                                name="chevron-forward"
                                size={18}
                                color={canStepForward ? '#404040' : '#D4D4D4'}
                            />
                        </TouchableOpacity>
                    </View>

                    <LineChart
                        buckets={trendBuckets}
                        selectedIdx={selectedBarIdx}
                        onSelectIdx={setSelectedBarIdx}
                    />

                    {/* X-axis labels. In day mode we can show all 14 (short
                        single-letter weekday), week/month modes get every
                        bucket labelled since the count is smaller. */}
                    <View style={styles.xAxisRow}>
                        <View style={styles.xAxisGutter} />
                        <View style={styles.xAxis}>
                            {trendBuckets.map((b, i) => (
                                <Text key={i} style={styles.xAxisLabel} numberOfLines={1}>
                                    {b.label}
                                </Text>
                            ))}
                        </View>
                    </View>

                    {/* Selected / default-focused bucket detail panel. We
                        show richer info here so users who want to "see exact
                        day/week/month" aren't limited to the tooltip. */}
                    <BucketDetail
                        bucket={focusBucket}
                        mode={trendMode}
                        isExplicit={!!activeBucket}
                        onClear={activeBucket ? () => setSelectedBarIdx(null) : null}
                    />

                    <TrendStats buckets={trendBuckets} />
                </View>

                {/* Chart 3: Settled vs outstanding */}
                <View style={styles.chartCard}>
                    <View style={styles.chartHeader}>
                        <View>
                            <Text style={styles.chartTitle}>Settlement health</Text>
                            <Text style={styles.chartSub}>
                                {fmtMoneyFull(settlementStats.totalSettled)} settled ·{' '}
                                {fmtMoneyFull(settlementStats.totalOutstanding)} outstanding
                            </Text>
                        </View>
                    </View>

                    <SettledBar
                        settled={settlementStats.totalSettled}
                        outstanding={settlementStats.totalOutstanding}
                    />

                    <View style={styles.settleGrid}>
                        <View style={[styles.settleCard, { borderColor: '#D1FAE5' }]}>
                            <View style={styles.settleRow}>
                                <Ionicons name="arrow-up-circle" size={18} color="#10B981" />
                                <Text style={styles.settleLabel}>You paid</Text>
                            </View>
                            <Text style={styles.settleValue}>
                                {fmtMoneyFull(settlementStats.settledSent)}
                            </Text>
                        </View>
                        <View style={[styles.settleCard, { borderColor: '#EEF2FF' }]}>
                            <View style={styles.settleRow}>
                                <Ionicons name="arrow-down-circle" size={18} color="#6366F1" />
                                <Text style={styles.settleLabel}>You received</Text>
                            </View>
                            <Text style={styles.settleValue}>
                                {fmtMoneyFull(settlementStats.settledReceived)}
                            </Text>
                        </View>
                        <View style={[styles.settleCard, { borderColor: '#FEE2E2' }]}>
                            <View style={styles.settleRow}>
                                <Ionicons name="hourglass-outline" size={18} color="#EF4444" />
                                <Text style={styles.settleLabel}>Still to pay</Text>
                            </View>
                            <Text style={styles.settleValue}>
                                {fmtMoneyFull(settlementStats.outstandingOwed)}
                            </Text>
                        </View>
                        <View style={[styles.settleCard, { borderColor: '#FEF3C7' }]}>
                            <View style={styles.settleRow}>
                                <Ionicons name="time-outline" size={18} color="#F59E0B" />
                                <Text style={styles.settleLabel}>Still owed</Text>
                            </View>
                            <Text style={styles.settleValue}>
                                {fmtMoneyFull(settlementStats.outstandingOwing)}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Insight card — a gentle nudge so the dashboard feels alive */}
                <Insight stats={settlementStats} kpis={kpis} topCategory={categorySegments[0]} />

                <View style={{ height: 24 }} />
            </ScrollView>
        </SafeAreaView>
    );
};

// ────────────────────────────────────────────────────────────────────────────
// Settled-vs-outstanding stacked bar
// ────────────────────────────────────────────────────────────────────────────
const SettledBar = ({ settled, outstanding }) => {
    const total = settled + outstanding;
    const width = Dimensions.get('window').width - 64;
    const height = 34;
    const settledW = total > 0 ? (settled / total) * width : 0;
    const outstandingW = total > 0 ? (outstanding / total) * width : 0;

    if (total === 0) {
        return (
            <View style={styles.emptyBar}>
                <Text style={styles.emptyBarText}>
                    No settlements yet — once you pay or receive, this chart lights up.
                </Text>
            </View>
        );
    }

    return (
        <View style={{ alignItems: 'center', marginTop: 8 }}>
            <Svg width={width} height={height}>
                <Rect
                    x={0}
                    y={0}
                    width={width}
                    height={height}
                    rx={8}
                    fill="#F5F5F5"
                />
                <Rect
                    x={0}
                    y={0}
                    width={settledW}
                    height={height}
                    rx={8}
                    fill="#10B981"
                />
                <Rect
                    x={settledW}
                    y={0}
                    width={outstandingW}
                    height={height}
                    fill="#F97316"
                />
            </Svg>
            <View style={styles.settleBarLegend}>
                <View style={styles.settleBarLegendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
                    <Text style={styles.settleBarLegendText}>
                        {total > 0
                            ? `${Math.round((settled / total) * 100)}% settled`
                            : '0% settled'}
                    </Text>
                </View>
                <View style={styles.settleBarLegendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#F97316' }]} />
                    <Text style={styles.settleBarLegendText}>
                        {total > 0
                            ? `${Math.round((outstanding / total) * 100)}% outstanding`
                            : '0% outstanding'}
                    </Text>
                </View>
            </View>
        </View>
    );
};

// ────────────────────────────────────────────────────────────────────────────
// Insight card — tiny rules-based nudge so the dashboard feels smart even
// without real ML behind it.
// ────────────────────────────────────────────────────────────────────────────
const Insight = ({ stats, kpis, topCategory }) => {
    let icon = 'bulb-outline';
    let color = '#F97316';
    let title = 'Track more expenses to unlock insights.';
    let body = 'As you add expenses and settle up, you\'ll see personalised tips here.';

    if (stats.totalOutstanding > 0 && stats.outstandingOwed > stats.outstandingOwing) {
        icon = 'alert-circle-outline';
        color = '#EF4444';
        title = `You have ${fmtMoneyFull(stats.outstandingOwed)} to pay back.`;
        body = 'Clearing the oldest debts first keeps your friendships — and your balance sheet — tidy.';
    } else if (stats.outstandingOwing > 0) {
        icon = 'cash-outline';
        color = '#10B981';
        title = `${fmtMoneyFull(stats.outstandingOwing)} is still owed to you.`;
        body = 'Send a quick reminder from the expense card to keep things moving.';
    } else if (topCategory) {
        icon = 'flame-outline';
        color = topCategory.color;
        title = `${topCategory.label} is your top spend.`;
        body = `You\'ve spent ${fmtMoneyFull(topCategory.value)} in this category during this period.`;
    } else if (kpis.monthSettled > 0) {
        icon = 'sparkles-outline';
        color = '#6366F1';
        title = 'You\'re all caught up!';
        body = `You\'ve settled ${fmtMoneyFull(kpis.monthSettled)} this month. Keep the streak going.`;
    }

    return (
        <View style={styles.insightCard}>
            <View style={[styles.insightIcon, { backgroundColor: color + '22' }]}>
                <Ionicons name={icon} size={22} color={color} />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={styles.insightTitle}>{title}</Text>
                <Text style={styles.insightBody}>{body}</Text>
            </View>
        </View>
    );
};

// ────────────────────────────────────────────────────────────────────────────
// Styles
// ────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FAFAFA',
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    },
    centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },

    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 24,
        paddingVertical: 16,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F5F5F5',
    },
    headerTitle: { fontSize: 28, fontWeight: '700', color: '#171717' },
    bell: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#F0F0F0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    bellBadge: {
        position: 'absolute',
        top: 4,
        right: 4,
        minWidth: 16,
        height: 16,
        paddingHorizontal: 4,
        borderRadius: 8,
        backgroundColor: '#EF4444',
        alignItems: 'center',
        justifyContent: 'center',
    },
    bellBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },

    scrollBody: { paddingHorizontal: 16, paddingBottom: 24 },

    kpiGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginTop: 4,
    },
    kpiCard: {
        width: '48%',
        flexGrow: 1,
        borderRadius: 16,
        padding: 14,
    },
    kpiLabel: { fontSize: 12, color: '#525252', marginTop: 8, fontWeight: '600' },
    kpiValue: { fontSize: 20, fontWeight: '800', marginTop: 2 },
    kpiSub: { fontSize: 11, color: '#737373', marginTop: 2 },

    rangeRow: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 16,
        marginBottom: 4,
    },
    rangePill: {
        flex: 1,
        paddingVertical: 8,
        borderRadius: 10,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E5E5E5',
        alignItems: 'center',
    },
    rangePillActive: { backgroundColor: '#F97316', borderColor: '#F97316' },
    rangeText: { fontSize: 13, color: '#525252', fontWeight: '600' },
    rangeTextActive: { color: '#FFFFFF' },

    chartCard: {
        backgroundColor: '#FFFFFF',
        padding: 16,
        borderRadius: 18,
        marginTop: 14,
        borderWidth: 1,
        borderColor: '#F0F0F0',
    },
    chartHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    chartTitle: { fontSize: 15, fontWeight: '800', color: '#171717' },
    chartSub: { fontSize: 12, color: '#737373', marginTop: 2 },
    clearBtn: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#F5F5F5',
        alignItems: 'center',
        justifyContent: 'center',
    },

    noData: {
        textAlign: 'center',
        marginTop: 12,
        color: '#A3A3A3',
        fontSize: 13,
    },

    legend: { marginTop: 12 },
    legendRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderRadius: 10,
    },
    legendRowActive: { backgroundColor: '#FFF7ED' },
    legendDot: { width: 10, height: 10, borderRadius: 5 },
    legendLabel: { flex: 1, marginLeft: 10, fontSize: 13, color: '#404040', fontWeight: '600' },
    legendPct: { fontSize: 12, color: '#737373', marginRight: 10 },
    legendValue: { fontSize: 13, color: '#171717', fontWeight: '700' },

    xAxisRow: { flexDirection: 'row', marginTop: 4 },
    // Matches the LineChart's padLeft so the first X-axis label lines up
    // with the first data dot instead of sitting under the Y-axis labels.
    xAxisGutter: { width: 54 },
    xAxis: { flex: 1, flexDirection: 'row', paddingRight: 22 },
    xAxisLabel: {
        flex: 1,
        textAlign: 'center',
        fontSize: 10,
        color: '#A3A3A3',
    },

    segmented: {
        flexDirection: 'row',
        backgroundColor: '#F5F5F5',
        borderRadius: 10,
        padding: 3,
        marginTop: 4,
        marginBottom: 10,
    },
    segment: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: 8,
    },
    segmentActive: {
        backgroundColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 3,
        shadowOffset: { width: 0, height: 1 },
        elevation: 1,
    },
    segmentText: { fontSize: 13, color: '#737373', fontWeight: '600' },
    segmentTextActive: { color: '#171717', fontWeight: '800' },

    navRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 8,
        paddingHorizontal: 4,
    },
    navBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#F5F5F5',
        alignItems: 'center',
        justifyContent: 'center',
    },
    navBtnDisabled: { backgroundColor: '#FAFAFA' },
    navCenter: { flex: 1, alignItems: 'center', paddingHorizontal: 8 },
    navLabel: { fontSize: 13, fontWeight: '700', color: '#171717' },
    todayChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 2,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
        backgroundColor: '#FFF7ED',
    },
    todayChipText: { fontSize: 10, color: '#F97316', fontWeight: '700' },

    bucketPanel: {
        marginTop: 14,
        padding: 14,
        backgroundColor: '#FAFAFA',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#F0F0F0',
    },
    bucketPanelHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
    },
    bucketPanelEyebrow: {
        fontSize: 10,
        color: '#A3A3A3',
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    bucketPanelTitle: { fontSize: 14, fontWeight: '800', color: '#171717', marginTop: 2 },

    bucketMiniStats: {
        flexDirection: 'row',
        marginTop: 12,
    },
    bucketMiniStat: { flex: 1 },
    bucketMiniLabel: { fontSize: 11, color: '#737373', fontWeight: '600' },
    bucketMiniValue: { fontSize: 15, fontWeight: '800', color: '#171717', marginTop: 2 },

    bucketEmpty: { marginTop: 12, fontSize: 12, color: '#A3A3A3' },

    topCatRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 14,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
    },
    topCatDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
    topCatLabel: { flex: 1, fontSize: 12, color: '#525252' },
    topCatName: { fontWeight: '800', color: '#171717' },
    topCatValue: { fontSize: 13, fontWeight: '800', color: '#171717' },

    expenseList: { marginTop: 10, gap: 8 },
    expenseItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    expenseIcon: {
        width: 24,
        height: 24,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    expenseTitle: { flex: 1, fontSize: 12, color: '#404040', fontWeight: '600' },
    expenseAmount: { fontSize: 12, color: '#171717', fontWeight: '700' },
    expenseMore: {
        marginTop: 4,
        textAlign: 'center',
        fontSize: 11,
        color: '#A3A3A3',
        fontWeight: '600',
    },

    trendStatsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 14,
        paddingTop: 14,
        borderTopWidth: 1,
        borderTopColor: '#F0F0F0',
    },
    trendStat: { flex: 1, alignItems: 'center' },
    trendStatDivider: { width: 1, height: 28, backgroundColor: '#F0F0F0' },
    trendStatLabel: { fontSize: 11, color: '#737373', fontWeight: '600' },
    trendStatValue: { fontSize: 14, fontWeight: '800', color: '#171717', marginTop: 4 },
    trendStatSub: { fontSize: 10, color: '#A3A3A3', marginTop: 2 },

    emptyBar: {
        marginTop: 10,
        padding: 14,
        backgroundColor: '#F5F5F5',
        borderRadius: 12,
    },
    emptyBarText: { color: '#737373', fontSize: 13, textAlign: 'center' },

    settleBarLegend: {
        marginTop: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
    },
    settleBarLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    settleBarLegendText: { fontSize: 11, color: '#525252', fontWeight: '600' },

    settleGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginTop: 16,
    },
    settleCard: {
        flex: 1,
        minWidth: '47%',
        borderRadius: 12,
        borderWidth: 1,
        padding: 12,
        backgroundColor: '#FFFFFF',
    },
    settleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    settleLabel: { fontSize: 12, color: '#525252', fontWeight: '600' },
    settleValue: { fontSize: 16, fontWeight: '800', color: '#171717', marginTop: 4 },

    insightCard: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        padding: 16,
        borderRadius: 16,
        marginTop: 14,
        borderWidth: 1,
        borderColor: '#F0F0F0',
        gap: 12,
    },
    insightIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    insightTitle: { fontSize: 14, fontWeight: '800', color: '#171717' },
    insightBody: { marginTop: 4, fontSize: 13, color: '#525252', lineHeight: 18 },
});

export default DashboardScreen;
