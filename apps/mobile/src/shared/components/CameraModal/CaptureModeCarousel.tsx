import { useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { TouchableRipple } from 'react-native-paper';
import Animated, { Extrapolate, interpolate, interpolateColor, useAnimatedStyle } from 'react-native-reanimated';
import Carousel, { ICarouselInstance } from 'react-native-reanimated-carousel';

const captureModes = ['photo', 'video'] as const;
export type CaptureMode = typeof captureModes[number];

export function CaptureModeCarousel({ onChange }: { onChange: (value: CaptureMode) => void }) {
  const { t } = useTranslation();

  const carouselRef = useRef<ICarouselInstance>(null);

  const data = useMemo(() => [t('camera.photo'), t('camera.video')] as CaptureMode[], [t]);

  return (
    <Carousel
      ref={carouselRef}
      width={120}
      height={40}
      mode="parallax"
      loop={false}
      modeConfig={{
        parallaxScrollingScale: 1,
        parallaxScrollingOffset: 50,
      }}
      style={{
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'visible',
      }}
      scrollAnimationDuration={300}
      data={data}
      defaultIndex={0}
      onSnapToItem={(index) => onChange(captureModes[index])}
      customAnimation={(value: number) => {
        'worklet';
        const scale = interpolate(value, [-1, 0, 1], [1, 1, 1], Extrapolate.CLAMP);
        const translate = interpolate(value, [0, 1], [0, 70]);
        const backgroundColor = interpolateColor(value, [-1, 0, 1], ['transparent', '#00000008', 'transparent']);

        return {
          transform: [
            { scale },
            {
              translateX: translate,
            },
            { perspective: 150 },
          ],
          backgroundColor,
          width: 80,
          borderRadius: 40,
        };
      }}
      renderItem={({ index, item, animationValue }) => (
        <CaptureModeItem
          animationValue={animationValue}
          text={item}
          onPress={() => carouselRef.current?.scrollTo({ index, animated: true })}
        />
      )}
    />
  );
}

function CaptureModeItem({
  animationValue,
  text,
  onPress,
}: {
  animationValue: Animated.SharedValue<number>;
  text: string;
  onPress?: () => void;
}) {
  const textAnimatedStyle = useAnimatedStyle(() => {
    const color = interpolateColor(animationValue.value, [-1, 0, 1], ['#ffffff80', '#fff', '#ffffff80']);

    return {
      color,
      textTransform: 'uppercase',

      fontWeight: '600',
    };
  });

  return (
    <TouchableRipple
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 40,
      }}
      onPress={onPress}
      borderless
    >
      <Animated.Text style={textAnimatedStyle}>{text}</Animated.Text>
    </TouchableRipple>
  );
}
