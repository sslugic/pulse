import { Gauge, HStack, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { containerBackground, font, foregroundStyle, padding } from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

export type PulseWidgetProps = {
  streak: number;
  kcalLeft: number;
  questsCleared: number;
  rank: string;
  rankProgress: number; // 0..1
  water: number; // 0..1 of target
};

// Runs in the widget extension's isolated runtime: only SwiftUI components, no hooks, nothing from
// outside this function (colors are inlined on purpose).
const PulseWidget = (props: PulseWidgetProps, environment: WidgetEnvironment) => {
  'widget';
  const bg = '#16181A';
  const lime = '#9CFF2E';
  const orange = '#FF7A1A';
  const yellow = '#FFD319';
  const dim = '#B5B09F';
  const family = environment.widgetFamily;

  if (family === 'accessoryCircular') {
    return (
      <Gauge value={Math.min(1, props.rankProgress)} max={1} currentValueLabel={<Text>{`${props.streak}`}</Text>}>
        <Text>🔥</Text>
      </Gauge>
    );
  }

  if (family === 'accessoryRectangular') {
    return (
      <VStack alignment="leading">
        <Text modifiers={[font({ weight: 'bold', size: 14 })]}>{`🔥 ${props.streak}-day streak`}</Text>
        <Text modifiers={[font({ size: 12 })]}>{`${props.kcalLeft} kcal left · ${props.questsCleared}/3 quests`}</Text>
      </VStack>
    );
  }

  const small = family === 'systemSmall';
  return (
    <VStack alignment="leading" modifiers={[padding({ all: 4 }), containerBackground(bg, 'widget')]}>
      <HStack>
        <Text modifiers={[font({ weight: 'black', size: small ? 28 : 34, design: 'rounded' }), foregroundStyle(yellow)]}>{`${props.streak}`}</Text>
        <Text modifiers={[font({ weight: 'bold', size: 12 }), foregroundStyle(orange)]}>{'🔥 DAY\nSTREAK'}</Text>
        <Spacer />
        {!small && <Text modifiers={[font({ weight: 'bold', size: 12 }), foregroundStyle(lime)]}>{props.rank.toUpperCase()}</Text>}
      </HStack>
      <Spacer />
      <Text modifiers={[font({ weight: 'bold', size: small ? 20 : 24, design: 'rounded' }), foregroundStyle('#F3EEDC')]}>{`${props.kcalLeft.toLocaleString()}`}</Text>
      <Text modifiers={[font({ weight: 'semibold', size: 11 }), foregroundStyle(dim)]}>{props.kcalLeft >= 0 ? 'KCAL LEFT TODAY' : 'KCAL OVER'}</Text>
      <Spacer />
      <HStack>
        <Text modifiers={[font({ weight: 'bold', size: 12 }), foregroundStyle(yellow)]}>{`🎯 ${props.questsCleared}/3`}</Text>
        <Spacer />
        <Text modifiers={[font({ weight: 'bold', size: 12 }), foregroundStyle('#3E8BFF')]}>{`💧 ${Math.round(props.water * 100)}%`}</Text>
      </HStack>
    </VStack>
  );
};

export default createWidget<PulseWidgetProps>('PulseWidget', PulseWidget, { streak: 0, kcalLeft: 0, questsCleared: 0, rank: 'Rookie', rankProgress: 0, water: 0 });
