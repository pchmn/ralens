import { Flex, useAppTheme } from '@ralens/react-native';
import { addDays } from 'date-fns';
import { useMemo } from 'react';
import { Button, IconButton } from 'react-native-paper';
import { en, registerTranslation } from 'react-native-paper-dates';
import { FadeInRight, FadeOutRight } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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
  const { top, bottom } = useSafeAreaInsets();

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

  const onSubmit = (values: CreateEventValues) => {
    console.log('values', values);
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
          <Button
            mode="contained"
            onPress={() => handleSubmit(onSubmit)}
            labelStyle={{ marginVertical: 5, marginHorizontal: 5 }}
          >
            Create
          </Button>
        </Flex>

        <Flex flex={1} justify="space-between" px="lg" py="xl" gap="xl">
          <CreateEventForm values={values} setValues={setValues} errors={errors} />
        </Flex>
      </Flex>
    </Modal>
  );
}
