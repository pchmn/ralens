import { Flex, useAppTheme } from '@ralens/react-native';
import { setBackgroundColorAsync as setNavigationBarBackgroundColorAsync } from 'expo-navigation-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Dimensions } from 'react-native';
import { ExpandingDot } from 'react-native-animated-pagination-dots';
import PagerView, { PagerViewOnPageScrollEventData } from 'react-native-pager-view';
import { Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import EarthImage from './views/EarthImage';
import { ExplanationView } from './views/ExplanationView';

const AnimatedPagerView = Animated.createAnimatedComponent(PagerView);

const ONBOARD_DATA = [
  {
    image: <EarthImage />,
    title: 'Bienvenue dans Ralens !',
    description: "Plongez dans l'ère des pellicules photos et découvrez la magie de l'attente et de la révélation.",
  },
  {
    image: <EarthImage />,
    title: 'Créez des pellicules',
    description: 'Prenez des photos sans voir le rendu et découvrez la surprise en développant la pellicule !',
  },
  {
    image: <EarthImage />,
    title: 'Créez des souvenirs collectifs',
    description: "Partagez des moments avec qui vous voulez lors d'événements privés !",
  },
];

export default function OnBoard() {
  // const [, setIsFirstLaunch] = useIsFirstLaunch();

  const theme = useAppTheme();

  const [currentPage, setCurrentPage] = useState(0);

  const pagerViewRef = useRef<PagerView>(null);
  const width = Dimensions.get('window').width;
  const scrollOffsetAnimatedValue = useRef(new Animated.Value(0)).current;
  const positionAnimatedValue = useRef(new Animated.Value(0)).current;
  const inputRange = [0, ONBOARD_DATA.length];
  const scrollX = Animated.add(scrollOffsetAnimatedValue, positionAnimatedValue).interpolate({
    inputRange,
    outputRange: [0, ONBOARD_DATA.length * width],
  });

  const onPageScroll = useMemo(
    () =>
      Animated.event<PagerViewOnPageScrollEventData>(
        [
          {
            nativeEvent: {
              offset: scrollOffsetAnimatedValue,
              position: positionAnimatedValue,
            },
          },
        ],
        {
          useNativeDriver: false,
        }
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const onContinue = () => {
    pagerViewRef.current?.setPage(currentPage + 1);
  };

  // const completeOnBoard = () => {
  //   console.log('completeOnBoard');
  //   setIsFirstLaunch(false);
  // };

  useEffect(() => {
    setNavigationBarBackgroundColorAsync(theme.colors.background);
  }, [theme]);

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <Flex flex={1} gap="lg" paddingY={40}>
        <AnimatedPagerView
          ref={pagerViewRef}
          style={{ flex: 1 }}
          initialPage={0}
          onPageScroll={onPageScroll}
          onPageSelected={(event) => setCurrentPage(event.nativeEvent.position)}
        >
          {ONBOARD_DATA.map(({ image, title, description }, index) => (
            <Flex key={index} flex={1} paddingX={40}>
              <ExplanationView image={image} title={title} description={description} />
            </Flex>
          ))}
        </AnimatedPagerView>

        <Flex direction="row" align="center" justify="space-between" paddingX={40}>
          <ExpandingDot
            data={ONBOARD_DATA}
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            //@ts-ignore
            scrollX={scrollX}
            inActiveDotOpacity={0.3}
            activeDotColor={theme.colors.primary}
            inActiveDotColor={theme.colors.primary}
            expandingDotWidth={20}
            dotStyle={{
              width: 10,
              height: 10,
              borderRadius: 5,
              marginHorizontal: 5,
            }}
            containerStyle={{
              position: 'relative',
              top: 0,
            }}
          />
          <Button mode="contained" onPress={onContinue}>
            Suivant
          </Button>
        </Flex>
      </Flex>
    </SafeAreaView>
  );
}
