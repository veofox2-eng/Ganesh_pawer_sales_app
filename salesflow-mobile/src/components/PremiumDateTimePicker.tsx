import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  Dimensions, ScrollView, Platform, TextInput
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { IconCalendar, IconTime } from '../lib/Icons';

interface PremiumDateTimePickerProps {
  visible: boolean;
  value: Date;
  mode?: 'datetime' | 'date' | 'time';
  minimumDate?: Date;
  onClose: () => void;
  onChange: (date: Date) => void;
}

export default function PremiumDateTimePicker({
  visible,
  value,
  mode = 'datetime',
  minimumDate,
  onClose,
  onChange
}: PremiumDateTimePickerProps) {
  const { colors } = useTheme();
  
  // Local state for temporary changes before clicking "OK"
  const [selectedDate, setSelectedDate] = useState<Date>(new Date(value));
  const [activeTab, setActiveTab] = useState<'date' | 'time'>(mode === 'time' ? 'time' : 'date');

  // Manual Keyboard Input States (independent to allow fluid keystrokes)
  const [hourInput, setHourInput] = useState<string>('');
  const [minuteInput, setMinuteInput] = useState<string>('');

  // Month navigation for Calendar view
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date(value));

  // Initialize input text when the modal opens or value shifts
  useEffect(() => {
    if (visible) {
      const d = new Date(value);
      setSelectedDate(d);
      setCurrentMonth(d);
      setActiveTab(mode === 'time' ? 'time' : 'date');
      
      const hours = d.getHours();
      const displayHour = hours % 12 === 0 ? 12 : hours % 12;
      const displayMinute = d.getMinutes();
      setHourInput(displayHour.toString().padStart(2, '0'));
      setMinuteInput(displayMinute.toString().padStart(2, '0'));
    }
  }, [visible, value]);

  // Calendar calculations
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth(); // 0-indexed

  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 (Sun) to 6 (Sat)
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const handleDaySelect = (day: number) => {
    const nd = new Date(selectedDate);
    nd.setFullYear(year, month, day);
    
    // Safety check for minimum date
    if (minimumDate) {
      const min = new Date(minimumDate);
      min.setSeconds(0);
      min.setMilliseconds(0);
      if (nd.getTime() < min.getTime()) {
        // Force to minimum date
        setSelectedDate(min);
        return;
      }
    }
    setSelectedDate(nd);
  };

  const handleMonthChange = (offset: number) => {
    setCurrentMonth(new Date(year, month + offset, 1));
  };

  // Hour and Minute updates
  const setHour = (h: number) => {
    const nd = new Date(selectedDate);
    nd.setHours(h);
    setSelectedDate(nd);
  };

  const setMinute = (m: number) => {
    const nd = new Date(selectedDate);
    nd.setMinutes(m);
    setSelectedDate(nd);
  };

  // Commit typed inputs with validation & intelligent 24-hour converter!
  const commitManualTimeInputs = (customHour?: string, customMin?: string) => {
    const hStr = customHour !== undefined ? customHour : hourInput;
    const mStr = customMin !== undefined ? customMin : minuteInput;

    let hNum = parseInt(hStr, 10);
    let mNum = parseInt(mStr, 10);

    if (isNaN(hNum)) hNum = 12;
    if (isNaN(mNum)) mNum = 0;

    const nd = new Date(selectedDate);
    let isPm = nd.getHours() >= 12;

    // Dynamic 24-hour hour conversion!
    if (hNum >= 13 && hNum <= 23) {
      hNum = hNum - 12;
      isPm = true;
    } else if (hNum === 0 || hNum === 24) {
      hNum = 12;
      isPm = false;
    }

    // Constrains
    if (hNum < 1) hNum = 1;
    if (hNum > 12) hNum = 12;

    if (mNum < 0) mNum = 0;
    if (mNum > 59) mNum = 59;

    const paddedH = hNum.toString().padStart(2, '0');
    const paddedM = mNum.toString().padStart(2, '0');
    
    setHourInput(paddedH);
    setMinuteInput(paddedM);

    const finalH = isPm ? (hNum === 12 ? 12 : hNum + 12) : (hNum === 12 ? 0 : hNum);
    nd.setHours(finalH);
    nd.setMinutes(mNum);
    setSelectedDate(nd);

    return nd;
  };

  const toggleAmPm = (isPm: boolean) => {
    // Commit current manual typing first
    const committed = commitManualTimeInputs();
    
    const nd = new Date(committed);
    let currentHours = nd.getHours();
    const isCurrentlyPm = currentHours >= 12;

    if (isPm && !isCurrentlyPm) {
      nd.setHours(currentHours + 12);
    } else if (!isPm && isCurrentlyPm) {
      nd.setHours(currentHours - 12);
    }
    setSelectedDate(nd);
  };

  const handleOk = (overrideDate?: Date) => {
    onChange(overrideDate || selectedDate);
    onClose();
  };

  const handleFooterAction = () => {
    if (activeTab === 'date' && mode === 'datetime') {
      setActiveTab('time');
    } else {
      const committedDate = commitManualTimeInputs();
      handleOk(committedDate);
    }
  };

  const getActionText = () => {
    if (activeTab === 'date' && mode === 'datetime') {
      return 'NEXT';
    }
    return 'SET TIME';
  };

  // Format Helpers
  const formatMonthName = (date: Date) => {
    return date.toLocaleString('default', { month: 'long', year: 'numeric' });
  };

  // Render Calendar Days
  const renderCalendar = () => {
    const totalSlots = daysInMonth + firstDayOfMonth;
    const rows = Math.ceil(totalSlots / 7);
    const cells: React.ReactNode[] = [];

    // Weekday labels
    const daysOfWeek = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

    for (let i = 0; i < rows * 7; i++) {
      const dayIndex = i - firstDayOfMonth + 1;
      const isValidDay = dayIndex > 0 && dayIndex <= daysInMonth;

      if (isValidDay) {
        const isSelected = 
          selectedDate.getDate() === dayIndex && 
          selectedDate.getMonth() === month && 
          selectedDate.getFullYear() === year;

        const isPast = minimumDate && new Date(year, month, dayIndex, 23, 59, 59).getTime() < minimumDate.getTime();

        cells.push(
          <TouchableOpacity
            key={`day-${dayIndex}`}
            style={[
              styles.dayCell,
              isSelected && { backgroundColor: colors.accent, borderRadius: 16 }
            ]}
            onPress={() => !isPast && handleDaySelect(dayIndex)}
            disabled={!!isPast}
          >
            <Text style={{
              fontSize: 13,
              fontWeight: isSelected ? '700' : '400',
              color: isPast 
                ? colors.textMuted 
                : isSelected 
                  ? '#fff' 
                  : colors.textPrimary
            }}>
              {dayIndex}
            </Text>
          </TouchableOpacity>
        );
      } else {
        cells.push(<View key={`empty-${i}`} style={styles.dayCell} />);
      }
    }

    return (
      <View style={styles.calendarContainer}>
        {/* Month Header Navigation */}
        <View style={styles.calendarNav}>
          <TouchableOpacity onPress={() => handleMonthChange(-1)} style={styles.navBtn}>
            <Text style={{ color: colors.accent, fontSize: 18, fontWeight: '700' }}>←</Text>
          </TouchableOpacity>
          <Text style={{ color: colors.textPrimary, fontWeight: '700', fontSize: 14 }}>
            {formatMonthName(currentMonth)}
          </Text>
          <TouchableOpacity onPress={() => handleMonthChange(1)} style={styles.navBtn}>
            <Text style={{ color: colors.accent, fontSize: 18, fontWeight: '700' }}>→</Text>
          </TouchableOpacity>
        </View>

        {/* Days of Week Row */}
        <View style={styles.weekRow}>
          {daysOfWeek.map(d => (
            <Text key={d} style={[styles.weekLabel, { color: colors.textMuted }]}>{d}</Text>
          ))}
        </View>

        {/* Calendar Grid */}
        <View style={styles.grid}>
          {cells}
        </View>
      </View>
    );
  };

  // Render Premium Clock
  const renderClock = () => {
    let hours = selectedDate.getHours();
    const isPm = hours >= 12;
    const displayHour = hours % 12 === 0 ? 12 : hours % 12;
    const displayMinute = selectedDate.getMinutes();

    return (
      <View style={styles.clockContainer}>
        {/* Large Time Display */}
        <View style={styles.timeDisplayRow}>
          <View style={[styles.timeBox, { backgroundColor: colors.bgPanel, borderColor: colors.border }]}>
            <TextInput
              style={[styles.timeInputText, { color: colors.accent }]}
              value={hourInput}
              onChangeText={(val) => {
                const clean = val.replace(/\D/g, '');
                if (clean.length <= 2) {
                  setHourInput(clean);
                }
              }}
              onBlur={() => commitManualTimeInputs()}
              keyboardType="numeric"
              maxLength={2}
              selectTextOnFocus
              placeholder="12"
              placeholderTextColor={colors.textMuted}
            />
            <Text style={{ color: colors.textMuted, fontSize: 10, marginTop: 2, textTransform: 'uppercase' }}>Hours</Text>
          </View>
          
          <Text style={[styles.colon, { color: colors.textPrimary }]}>:</Text>

          <View style={[styles.timeBox, { backgroundColor: colors.bgPanel, borderColor: colors.border }]}>
            <TextInput
              style={[styles.timeInputText, { color: colors.accent }]}
              value={minuteInput}
              onChangeText={(val) => {
                const clean = val.replace(/\D/g, '');
                if (clean.length <= 2) {
                  setMinuteInput(clean);
                }
              }}
              onBlur={() => commitManualTimeInputs()}
              keyboardType="numeric"
              maxLength={2}
              selectTextOnFocus
              placeholder="00"
              placeholderTextColor={colors.textMuted}
            />
            <Text style={{ color: colors.textMuted, fontSize: 10, marginTop: 2, textTransform: 'uppercase' }}>Mins</Text>
          </View>

          {/* AM/PM Toggle */}
          <View style={styles.ampmCol}>
            <TouchableOpacity 
              style={[
                styles.ampmBtn, 
                !isPm && { backgroundColor: colors.accent, borderColor: colors.accent }
              ]} 
              onPress={() => toggleAmPm(false)}
            >
              <Text style={[styles.ampmText, { color: !isPm ? '#fff' : colors.textMuted }]}>AM</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[
                styles.ampmBtn, 
                isPm && { backgroundColor: colors.accent, borderColor: colors.accent },
                { marginTop: 6 }
              ]} 
              onPress={() => toggleAmPm(true)}
            >
              <Text style={[styles.ampmText, { color: isPm ? '#fff' : colors.textMuted }]}>PM</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Quick select Hours & Minutes */}
        <Text style={[styles.subLabel, { color: colors.textMuted, marginTop: 20 }]}>Select Hour</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 4 }}>
          {Array.from({ length: 12 }, (_, i) => i + 1).map(h => {
            const isSelected = displayHour === h;
            return (
              <TouchableOpacity
                key={`h-${h}`}
                onPress={() => {
                  const finalH = isPm ? (h === 12 ? 12 : h + 12) : (h === 12 ? 0 : h);
                  setHour(finalH);
                  setHourInput(h.toString().padStart(2, '0'));
                }}
                style={[
                  styles.quickSelector,
                  { backgroundColor: colors.bgPanel, borderColor: isSelected ? colors.accent : colors.border }
                ]}
              >
                <Text style={{ color: isSelected ? colors.accent : colors.textPrimary, fontWeight: isSelected ? '700' : '400', fontSize: 13 }}>
                  {h}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <Text style={[styles.subLabel, { color: colors.textMuted, marginTop: 12 }]}>Select Minute</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 4 }}>
          {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map(m => {
            const isSelected = Math.abs(displayMinute - m) < 3; // nearest interval match
            return (
              <TouchableOpacity
                key={`m-${m}`}
                onPress={() => {
                  setMinute(m);
                  setMinuteInput(m.toString().padStart(2, '0'));
                }}
                style={[
                  styles.quickSelector,
                  { backgroundColor: colors.bgPanel, borderColor: isSelected ? colors.accent : colors.border }
                ]}
              >
                <Text style={{ color: isSelected ? colors.accent : colors.textPrimary, fontWeight: isSelected ? '700' : '400', fontSize: 13 }}>
                  {m.toString().padStart(2, '0')}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  const getHeaderDateString = () => {
    return selectedDate.toLocaleDateString('default', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  const getHeaderTimeString = () => {
    let hours = selectedDate.getHours();
    const isPm = hours >= 12;
    const displayHour = hours % 12 === 0 ? 12 : hours % 12;
    const displayMinute = selectedDate.getMinutes();
    return `${displayHour.toString().padStart(2, '0')}:${displayMinute.toString().padStart(2, '0')} ${isPm ? 'PM' : 'AM'}`;
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          
          {/* Header Area */}
          <View style={[styles.headerArea, { borderBottomColor: colors.border }]}>
            <View>
              <Text style={[styles.headerDate, { color: colors.textPrimary }]}>{getHeaderDateString()}</Text>
              <Text style={[styles.headerTime, { color: colors.accent }]}>{getHeaderTimeString()}</Text>
            </View>
            
            {/* View switcher Tabs */}
            {mode === 'datetime' && (
              <View style={[styles.tabRow, { backgroundColor: colors.bgPanel }]}>
                <TouchableOpacity 
                  style={[styles.tabBtn, activeTab === 'date' && { backgroundColor: colors.accent }]}
                  onPress={() => setActiveTab('date')}
                >
                  <IconCalendar size={16} color={activeTab === 'date' ? '#fff' : colors.textMuted} />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.tabBtn, activeTab === 'time' && { backgroundColor: colors.accent }]}
                  onPress={() => setActiveTab('time')}
                >
                  <IconTime size={16} color={activeTab === 'time' ? '#fff' : colors.textMuted} />
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Body Content */}
          <View style={styles.bodyContent}>
            {activeTab === 'date' ? renderCalendar() : renderClock()}
          </View>

          {/* Footer Buttons */}
          <View style={[styles.footerRow, { borderTopColor: colors.border }]}>
            <TouchableOpacity onPress={onClose} style={styles.footerBtn}>
              <Text style={{ color: colors.textMuted, fontWeight: '600', fontSize: 14 }}>CANCEL</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleFooterAction} style={[styles.footerBtn, styles.okBtn, { backgroundColor: colors.accent }]}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>{getActionText()}</Text>
            </TouchableOpacity>
          </View>

        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    width: Dimensions.get('window').width * 0.88,
    maxWidth: 340,
    borderRadius: 24,
    borderWidth: 1,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  headerArea: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerDate: {
    fontSize: 18,
    fontWeight: '800',
  },
  headerTime: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 2,
  },
  tabRow: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 3,
  },
  tabBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bodyContent: {
    paddingVertical: 12,
    minHeight: 250,
    justifyContent: 'center',
  },
  calendarContainer: {
    width: '100%',
  },
  calendarNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  navBtn: {
    padding: 6,
    borderRadius: 8,
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  weekLabel: {
    width: '14%',
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  dayCell: {
    width: '14.28%',
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  clockContainer: {
    width: '100%',
    paddingHorizontal: 4,
  },
  timeDisplayRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timeBox: {
    width: 65,
    height: 65,
    borderRadius: 16,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timeInputText: {
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
    width: '100%',
    padding: 0,
  },
  colon: {
    fontSize: 28,
    fontWeight: '700',
    marginHorizontal: 10,
  },
  ampmCol: {
    marginLeft: 12,
  },
  ampmBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
  },
  ampmText: {
    fontSize: 11,
    fontWeight: '800',
  },
  subLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 6,
    paddingLeft: 2,
  },
  quickSelector: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginRight: 6,
    minWidth: 40,
    alignItems: 'center',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    gap: 10,
  },
  footerBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  okBtn: {
    paddingHorizontal: 18,
  },
});
