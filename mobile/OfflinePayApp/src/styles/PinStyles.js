import { StyleSheet } from 'react-native';


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f23',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  logo: {
    fontSize: 48,
    marginBottom: 8,
  },
  appName: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 40,
  },
  title: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    color: '#888',
    fontSize: 14,
    marginBottom: 40,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 20,
    marginBottom: 48,
  },
  dot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#6366f1',
    backgroundColor: 'transparent',
  },
  dotFilled: {
    backgroundColor: '#6366f1',
  },
  pad: {
    gap: 16,
  },
  padRow: {
    flexDirection: 'row',
    gap: 24,
  },
  padBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#1a1a3e',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a5e',
  },
  padBtnEmpty: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  padBtnText: {
    color: 'white',
    fontSize: 24,
    fontWeight: '600',
  },

});  
export default styles;