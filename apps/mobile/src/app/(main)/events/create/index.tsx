import { Event, EventParticipant, INSERT_EVENT, INSERT_EVENT_PARTICIPANT } from '@ralens/core';
import { Flex, SafeAreaView, useFocusEffect, useInsertMutation } from '@ralens/react-native';
import { addDays } from 'date-fns';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, IconButton } from 'react-native-paper';

import { ArrowLeftIcon } from '@/shared/components';
import { useForm } from '@/shared/hooks';

import { CreateEventForm, CreateEventSchema, CreateEventValues } from './CreateEventForm';

export default function CreateEvent() {
  const router = useRouter();

  const { t } = useTranslation();

  const [insertEvent, { loading: insertEventLoading }] = useInsertMutation<Event, { id: string }>(INSERT_EVENT);
  const [insertEventParticipant, { loading: insertEventParticipantLoading }] = useInsertMutation<
    EventParticipant,
    { eventId: string; userId: string }
  >(INSERT_EVENT_PARTICIPANT);
  const loading = insertEventLoading || insertEventParticipantLoading;

  const initialValues = useMemo(() => {
    const today = new Date();
    today.setSeconds(0);
    today.setMilliseconds(0);

    return {
      name: '',
      startAt: today,
      endAt: addDays(today, 1),
    };
  }, []);
  const { values, setValues, handleSubmit, errors, reset } = useForm({
    schema: CreateEventSchema,
    initialValues,
  });

  const onSubmit = async (values: CreateEventValues) => {
    const { id } = await insertEvent(values);
    await insertEventParticipant({
      eventId: id,
    });
    // onCreate(id);
    goBack();
  };

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/events/');
    }
  };

  useFocusEffect(() => {
    return () => {
      reset();
    };
  }, [reset]);

  return (
    <SafeAreaView>
      <Flex direction="row" height={64} justify="space-between" align="center" pr="lg">
        <IconButton icon={({ color }) => <ArrowLeftIcon color={color} />} onPress={reset} />
        <Button
          mode="contained"
          onPress={() => handleSubmit(onSubmit)}
          labelStyle={{ marginVertical: 5, marginHorizontal: 5 }}
          compact
          loading={loading}
        >
          {t('events.createEvent.create')}
        </Button>
      </Flex>

      <Flex flex={1} justify="space-between" px="lg" py="xl" gap="xl">
        <CreateEventForm values={values} setValues={setValues} errors={errors} />
      </Flex>
    </SafeAreaView>
  );
}
