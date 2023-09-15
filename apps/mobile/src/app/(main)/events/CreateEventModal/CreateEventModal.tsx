import { Flex, Text, useAppTheme } from '@ralens/react-native';
import { addDays, format } from 'date-fns';
import { enGB } from 'date-fns/locale';
import { useState } from 'react';
import { Button, IconButton, TextInput as PaperInput } from 'react-native-paper';
import { DatePickerModal, TimePickerModal } from 'react-native-paper-dates';
import { en, registerTranslation } from 'react-native-paper-dates';
import { FadeInRight, FadeOutRight } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ArrowLeftIcon, CalendarIcon, Modal, TextIcon } from '@/shared/components';
registerTranslation('en', en);
registerTranslation('fr', en);

interface Props {
  visible: boolean;
  onClose: () => void;
  onCreation?: (id: string) => void;
}

export function CreateEventModal({ visible, onClose }: Props) {
  const theme = useAppTheme();
  const { top, bottom } = useSafeAreaInsets();

  const today = new Date();
  const [startDate, setStartDate] = useState<Date | undefined>(today);
  const [endDate, setEndDate] = useState<Date | undefined>(addDays(today, 1));
  const [timePickerVisible, setTimePickerVisible] = useState<'start' | 'end' | null>(null);
  const [datePickerVisible, setDatePickerVisible] = useState<'start' | 'end' | null>(null);

  const onDateConfirm = ({ date }: { date?: Date }) => {
    setDatePickerVisible(null);

    if (!date) return;

    if (datePickerVisible === 'start') {
      setStartDate((prev) => {
        const newDate = new Date(prev || new Date());
        newDate.setDate(date.getDate());
        newDate.setMonth(date.getMonth());
        newDate.setFullYear(date.getFullYear());
        return newDate;
      });
    } else {
      setEndDate((prev) => {
        const newDate = new Date(prev || new Date());
        newDate.setDate(date.getDate());
        newDate.setMonth(date.getMonth());
        newDate.setFullYear(date.getFullYear());
        return newDate;
      });
    }
  };

  const onTimeConfirm = ({ hours, minutes }: { hours: number; minutes: number }) => {
    setTimePickerVisible(null);

    if (timePickerVisible === 'start') {
      setStartDate((prev) => {
        const newDate = new Date(prev || new Date());
        newDate.setHours(hours);
        newDate.setMinutes(minutes);
        return newDate;
      });
    } else {
      setEndDate((prev) => {
        const newDate = new Date(prev || new Date());
        newDate.setHours(hours);
        newDate.setMinutes(minutes);
        return newDate;
      });
    }
  };

  return (
    <Modal
      fullScreen
      visible={visible}
      onDismiss={onClose}
      enteringAnimation={FadeInRight.duration(200)}
      exitingAnimation={FadeOutRight.duration(200)}
      containerStyle={{ backgroundColor: theme.colors.background, paddingTop: top, paddingBottom: bottom }}
    >
      <Flex flex={1}>
        <Flex direction="row" height={64} justify="space-between" align="center" pr="lg">
          <Flex direction="row" align="center">
            <IconButton icon={({ color }) => <ArrowLeftIcon color={color} />} onPress={onClose} />
            {/* <Text variant="titleLarge">Create an event</Text> */}
          </Flex>
          <Button mode="contained" onPress={onClose} labelStyle={{ marginVertical: 5, marginHorizontal: 5 }}>
            Create
          </Button>
        </Flex>

        <Flex flex={1} justify="space-between" px="lg" py="xl" gap="xl">
          <Flex flex={1}>
            <Flex direction="row" align="center" gap="xl" mb="lg">
              <TextIcon color={theme.colors.outlineVariant} />
              <PaperInput
                autoFocus
                mode="outlined"
                placeholder="Choose a name"
                style={{ flex: 1 }}
                outlineColor="transparent"
                activeOutlineColor="transparent"
                cursorColor={theme.colors.primary}
                selectionColor={theme.colors.primary}
                contentStyle={{
                  fontSize: 22,
                  marginBottom: 8,
                  marginTop: 0,
                  paddingHorizontal: 0,
                  paddingVertical: 0,
                }}
              />
            </Flex>

            <Flex gap="md">
              <Flex direction="row" align="center" gap="xl">
                <CalendarIcon color={theme.colors.outlineVariant} />
                <Flex direction="row" align="center" gap="xs" wrap="wrap">
                  <Text color={theme.colors.onSurfaceVariant}>From</Text>
                  <Button
                    onPress={() => setDatePickerVisible('start')}
                    textColor={theme.colors.onBackground}
                    labelStyle={{ fontSize: 16 }}
                  >
                    {format(startDate || new Date(), 'EEE, PP', { locale: enGB })}
                  </Button>
                  <Text color={theme.colors.onSurfaceVariant}>at</Text>
                  <Button
                    onPress={() => setTimePickerVisible('start')}
                    textColor={theme.colors.onBackground}
                    labelStyle={{ fontSize: 16 }}
                  >
                    {format(startDate || new Date(), 'HH:mm')}
                  </Button>
                </Flex>
              </Flex>
              <Flex direction="row" align="center" gap="xl">
                <CalendarIcon color={'transparent'} />
                <Flex flex={1} direction="row" align="center" gap="xs" wrap="wrap">
                  <Text color={theme.colors.onSurfaceVariant}>To</Text>
                  <Button
                    onPress={() => setDatePickerVisible('end')}
                    textColor={theme.colors.onBackground}
                    labelStyle={{ fontSize: 16 }}
                  >
                    {format(endDate || new Date(), 'EEE, PP', { locale: enGB })}
                  </Button>
                  <Text color={theme.colors.onSurfaceVariant}>at</Text>
                  <Button
                    onPress={() => setTimePickerVisible('end')}
                    textColor={theme.colors.onBackground}
                    labelStyle={{ fontSize: 16 }}
                  >
                    {format(endDate || new Date(), 'HH:mm')}
                  </Button>
                </Flex>
              </Flex>
            </Flex>
          </Flex>
        </Flex>
      </Flex>

      <DatePickerModal
        locale="en"
        label="Start date"
        mode="single"
        visible={!!datePickerVisible}
        onDismiss={() => setDatePickerVisible(null)}
        onConfirm={onDateConfirm}
        animationType="fade"
        disableStatusBarPadding
      />
      <TimePickerModal
        visible={!!timePickerVisible}
        onDismiss={() => setTimePickerVisible(null)}
        onConfirm={onTimeConfirm}
        hours={timePickerVisible === 'start' ? startDate?.getHours() || 0 : endDate?.getHours() || 0}
        minutes={timePickerVisible === 'start' ? startDate?.getMinutes() || 0 : endDate?.getMinutes() || 0}
        animationType="fade"
      />
    </Modal>
  );
}
