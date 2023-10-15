import { Flex, SafeAreaView, useFocusEffect } from '@ralens/react-native';
import { addDays } from 'date-fns';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, IconButton } from 'react-native-paper';

import { ArrowLeftIcon } from '@/shared/components';
import { useForm, useNhostFunctions } from '@/shared/hooks';

import { CreateEventForm, CreateEventSchema, CreateEventValues } from './CreateEventForm';

export default function CreateEvent() {
  const router = useRouter();

  const { t } = useTranslation();

  const { call } = useNhostFunctions();

  const [loading, setLoading] = useState(false);

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
    setLoading(true);
    await call('CreateEvent', values);
    setLoading(false);

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
      <Flex direction="row" height={64} justify="space-between" align="center" pl="xs" pr="lg">
        <IconButton icon={({ color }) => <ArrowLeftIcon color={color} />} onPress={goBack} />
        <Button
          mode="contained"
          onPress={() => handleSubmit(onSubmit)}
          labelStyle={{ marginVertical: 5 }}
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
