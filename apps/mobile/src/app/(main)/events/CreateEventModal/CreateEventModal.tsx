import { CREATE_EVENT, Event } from '@ralens/core';
import { Flex, useAppTheme, useInsertMutation } from '@ralens/react-native';
import { addDays } from 'date-fns';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, IconButton } from 'react-native-paper';
import { en, registerTranslation } from 'react-native-paper-dates';
import { FadeInRight, FadeOutRight } from 'react-native-reanimated';

import { ArrowLeftIcon, Modal } from '@/shared/components';
import { useForm } from '@/shared/hooks';

import { CreateEventForm, CreateEventSchema, CreateEventValues } from './CreateEventForm';
registerTranslation('en', en);
registerTranslation('fr', en);

interface Props {
  visible: boolean;
  onClose: () => void;
  onCreation?: (id: string) => void;
}

export function CreateEventModal({ visible, onClose }: Props) {
  const theme = useAppTheme();

  return (
    <Modal
      fullScreen
      visible={visible}
      onDismiss={onClose}
      enteringAnimation={FadeInRight.duration(200)}
      exitingAnimation={FadeOutRight.duration(200)}
      bgColor={theme.colors.background}
      insetsPadding
    >
      <CreateEvent onClose={onClose} onCreate={onClose} />
    </Modal>
  );
}

function CreateEvent({ onClose, onCreate }: { onClose: () => void; onCreate: (id: string) => void }) {
  const { t } = useTranslation();

  const [create, { loading }] = useInsertMutation<Event>(CREATE_EVENT);

  const today = useMemo(() => {
    const today = new Date();
    today.setSeconds(0);
    today.setMilliseconds(0);
    return today;
  }, []);
  const { values, setValues, handleSubmit, errors } = useForm({
    schema: CreateEventSchema,
    initialValues: {
      name: '',
      startAt: today,
      endAt: addDays(today, 1),
    },
  });

  const onSubmit = async (values: CreateEventValues) => {
    const { data } = await create(values);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (data && (data as any).insert_events_one?.id) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onCreate((data as any).insert_events_one?.id);
    }
  };

  return (
    <Flex flex={1}>
      <Flex direction="row" height={64} justify="space-between" align="center" pr="lg">
        <IconButton icon={({ color }) => <ArrowLeftIcon color={color} />} onPress={onClose} />
        <Button
          mode="contained"
          onPress={() => handleSubmit(onSubmit)}
          labelStyle={{ marginVertical: 5, marginHorizontal: 5 }}
          loading={loading}
        >
          {t('events.createEvent.create')}
        </Button>
      </Flex>

      <Flex flex={1} justify="space-between" px="lg" py="xl" gap="xl">
        <CreateEventForm values={values} setValues={setValues} errors={errors} />
      </Flex>
    </Flex>
  );
}
