import {Platform, StyleSheet} from 'react-native';

export const colors = {
  ink: '#FFF8FF',
  muted: '#DCCBE4',
  dimmed: '#A88EAF',
  blush: '#FFB6CF',
  rose: '#FF6FA3',
  lavender: '#B99CFF',
  violet: '#7750B8',
  plum: '#291433',
  night: '#100914',
  glass: 'rgba(38, 19, 47, 0.72)',
  glassStrong: 'rgba(29, 13, 37, 0.92)',
  line: 'rgba(255, 255, 255, 0.15)',
  whiteGlass: 'rgba(255, 255, 255, 0.12)',
  success: '#A7F3D0',
  danger: '#FF9EBB',
};

export const shadow = Platform.select({
  ios: {
    shadowColor: '#000000',
    shadowOffset: {width: 0, height: 10},
    shadowOpacity: 0.28,
    shadowRadius: 22,
  },
  android: {elevation: 10},
  default: {},
});

export const sharedStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.glass,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 24,
    ...shadow,
  },
  eyebrow: {
    color: colors.blush,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
  },
});
