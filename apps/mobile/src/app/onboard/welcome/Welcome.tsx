import { Flex, Text, useAppTheme } from '@ralens/react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dimensions, PixelRatio } from 'react-native';
import { Button } from 'react-native-paper';

import { CameraImage } from './CameraImage';
import { FilmRollImage } from './FilmRollImage';

const { height: windowHeight } = Dimensions.get('window');
const py = PixelRatio.getPixelSizeForLayoutSize(40);

export function Welcome({ onContine }: { onContine: () => void }) {
  const theme = useAppTheme();

  const { t } = useTranslation();

  const [height, setHeight] = useState(0);
  const filmRollHeight = height * 1.05;
  const cameraImageSize = filmRollHeight / 3;

  return (
    <Flex flex={1}>
      <Flex
        direction="row"
        justify="center"
        height="50%"
        bgColor={theme.colors.background}
        position="relative"
        onLayout={({ nativeEvent: { layout } }) => {
          setHeight(layout.height);
        }}
      >
        <FilmRollImage
          height={filmRollHeight}
          style={{
            position: 'absolute',
            top: -20,
          }}
        />
        <Flex position="absolute" style={{ top: filmRollHeight / 2 - 20 - cameraImageSize / 2 - 10 }}>
          <CameraImage height={cameraImageSize} width={cameraImageSize} />
        </Flex>
      </Flex>
      <Flex justify="center" px={40} pt={py / 1.5} flex={1}>
        <Flex gap={20}>
          <Text variant={windowHeight < 700 ? 'headlineSmall' : 'headlineMedium'}>{t('onboard.welcome.title')}</Text>
          <Text variant={windowHeight < 700 ? 'bodySmall' : 'bodyMedium'} style={{ opacity: 0.75, lineHeight: 25 }}>
            {t('onboard.welcome.description')}
          </Text>
        </Flex>
        <Flex flex={1} justify="center" align="center">
          <Button mode="contained" onPress={onContine}>
            {t('onboard.welcome.getStarted')}
          </Button>
        </Flex>
      </Flex>
    </Flex>
  );
}
