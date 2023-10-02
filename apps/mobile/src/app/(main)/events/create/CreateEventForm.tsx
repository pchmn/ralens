import { Flex, Text, useAppTheme, useFocusEffect } from '@ralens/react-native';
import { format } from 'date-fns';
import { enGB } from 'date-fns/locale';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TextInput as NativeInput } from 'react-native';
import { Button, TextInput } from 'react-native-paper';
import { DatePickerModal, TimePickerModal } from 'react-native-paper-dates';
import { date, Input, object, string } from 'valibot';

import { CalendarIcon, TextIcon } from '@/shared/components';

export const CreateEventSchema = object(
  {
    name: string([
      (input) => {
        if (input.length === 0) {
          return {
            issue: {
              validation: 'required',
              message: 'nameRequiredError',
              input,
            },
          };
        }
        return { output: input };
      },
    ]),
    startAt: date(),
    endAt: date(),
  },
  [
    (input) => {
      if (input.startAt >= input.endAt) {
        return {
          issue: {
            validation: 'dateRange',
            message: 'endAtSupStartAtError',
            input: input.endAt,
            path: [
              {
                key: 'endAt',
                value: input,
                input: input.endAt,
                schema: 'object',
              },
            ],
          },
        };
      }
      return { output: input };
    },
  ]
);
export type CreateEventValues = Input<typeof CreateEventSchema>;

export function CreateEventForm({
  values,
  errors,
  setValues,
}: {
  values: CreateEventValues;
  errors?: { [key in keyof Partial<CreateEventValues>]: string };
  setValues: (values: Partial<CreateEventValues>) => void;
}) {
  const { t } = useTranslation();

  const theme = useAppTheme();

  const [timePickerVisible, setTimePickerVisible] = useState<'startAt' | 'endAt' | null>(null);
  const [datePickerVisible, setDatePickerVisible] = useState<'startAt' | 'endAt' | null>(null);

  const inputRef = useRef<NativeInput>(null);

  const onDateConfirm = ({ date }: { date?: Date }) => {
    if (!date || !datePickerVisible) return;

    const newDate = values[datePickerVisible];
    newDate.setDate(date.getDate());
    newDate.setMonth(date.getMonth());
    newDate.setFullYear(date.getFullYear());
    setValues({ [datePickerVisible]: newDate });

    setDatePickerVisible(null);
  };

  const onTimeConfirm = ({ hours, minutes }: { hours: number; minutes: number }) => {
    if (!timePickerVisible) return;

    const newDate = values[timePickerVisible];
    newDate.setHours(hours);
    newDate.setMinutes(minutes);
    setValues({ [timePickerVisible]: newDate });

    setTimePickerVisible(null);
  };

  useFocusEffect(() => {
    setTimeout(() => inputRef.current?.focus());

    return () => {
      inputRef.current?.blur();
      inputRef.current?.clear();
    };
  }, []);

  return (
    <Flex flex={1}>
      {/* Event name */}
      <Flex mb="lg">
        <Flex direction="row" align="center" gap="xl">
          <TextIcon color={theme.colors.outlineVariant} />
          <TextInput
            ref={inputRef}
            mode="outlined"
            placeholder={t('events.createEvent.namePlaceholder')}
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
              borderBottomColor: errors?.name ? theme.colors.error : 'transparent',
              borderBottomWidth: 1,
            }}
            defaultValue={values.name}
            onChangeText={(name) => setValues({ name })}
          />
        </Flex>
        <Flex direction="row" align="center" gap="xl" wrap="wrap">
          <Flex height={24} width={24} />
          <Flex flex={1} direction="row" align="center" wrap="wrap">
            {errors?.name && <Text color={theme.colors.error}>{t(`events.createEvent.${errors.name}`)}</Text>}
          </Flex>
        </Flex>
      </Flex>

      <Flex gap="md">
        <Flex direction="row" align="center" gap="xl">
          <CalendarIcon color={theme.colors.outlineVariant} />
          <Flex direction="row" align="center" gap="xs" wrap="wrap">
            <Text color={theme.colors.onSurfaceVariant}>{t('events.createEvent.from')}</Text>
            <Button
              onPress={() => setDatePickerVisible('startAt')}
              textColor={theme.colors.onBackground}
              labelStyle={{ fontSize: 16 }}
            >
              {format(values.startAt, 'EEE, PP', { locale: enGB })}
            </Button>
            <Text color={theme.colors.onSurfaceVariant}>{t('events.createEvent.at')}</Text>
            <Button
              onPress={() => setTimePickerVisible('startAt')}
              textColor={theme.colors.onBackground}
              labelStyle={{ fontSize: 16 }}
            >
              {format(values.startAt, 'HH:mm')}
            </Button>
          </Flex>
        </Flex>
        <Flex direction="row" align="center" gap="xl">
          <CalendarIcon color={'transparent'} />
          <Flex flex={1} direction="row" align="center" gap="xs" wrap="wrap">
            <Text color={theme.colors.onSurfaceVariant}>{t('events.createEvent.to')}</Text>
            <Button
              onPress={() => setDatePickerVisible('endAt')}
              textColor={theme.colors.onBackground}
              labelStyle={{ fontSize: 16 }}
            >
              {format(values.endAt, 'EEE, PP', { locale: enGB })}
            </Button>
            <Text color={theme.colors.onSurfaceVariant}>{t('events.createEvent.at')}</Text>
            <Button
              onPress={() => setTimePickerVisible('endAt')}
              textColor={theme.colors.onBackground}
              labelStyle={{ fontSize: 16 }}
            >
              {format(values.endAt, 'HH:mm')}
            </Button>
          </Flex>
        </Flex>
        <Flex direction="row" align="center" gap="xl">
          <Flex height={24} width={24} />
          <Flex flex={1} direction="row" align="center" wrap="wrap">
            {errors?.endAt && <Text color={theme.colors.error}>{t(`events.createEvent.${errors.endAt}`)}</Text>}
          </Flex>
        </Flex>
      </Flex>

      <DatePickerModal
        locale="en"
        label={t(`events.createEvent.${datePickerVisible}`)}
        mode="single"
        visible={!!datePickerVisible}
        date={datePickerVisible ? values[datePickerVisible] : undefined}
        onDismiss={() => setDatePickerVisible(null)}
        onConfirm={onDateConfirm}
        animationType="fade"
        disableStatusBarPadding
      />
      <TimePickerModal
        visible={!!timePickerVisible}
        onDismiss={() => setTimePickerVisible(null)}
        onConfirm={onTimeConfirm}
        hours={timePickerVisible === 'startAt' ? values.startAt.getHours() : values.endAt.getHours()}
        minutes={timePickerVisible === 'startAt' ? values.startAt.getMinutes() : values.endAt.getMinutes()}
        animationType="fade"
      />
    </Flex>
  );
}
