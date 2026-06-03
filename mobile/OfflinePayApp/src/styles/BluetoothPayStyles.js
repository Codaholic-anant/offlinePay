import { StyleSheet } from 'react-native';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f23',
    padding: 24,
    paddingTop: 56,
  },

  backBtn: {
    marginBottom: 20,
  },

  backText: {
    color: '#6366f1',
    fontSize: 16,
  },

  title: {
    color: 'white',
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },

  subtitle: {
    color: '#888',
    fontSize: 13,
    marginBottom: 24,
  },

  statusCard: {
    backgroundColor: '#1a1a3e',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#2a2a5e',
  },

  statusCardReady: {
    borderColor: '#3b82f6',
    backgroundColor: '#1e3a5f',
  },

  statusText: {
    color: 'white',
    fontWeight: '600',
    textAlign: 'center',
    fontSize: 14,
  },

  scanBtn: {
    backgroundColor: '#3b82f6',
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    marginBottom: 12,
  },

  scanBtnDisabled: {
    opacity: 0.5,
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  scanBtnText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },

  retryBtn: {
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#6366f1',
  },

  retryText: {
    color: '#6366f1',
    fontSize: 14,
    fontWeight: '600',
  },

  deviceCount: {
    color: '#6366f1',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12,
  },

  emptyBox: {
    alignItems: 'center',
    padding: 40,
  },

  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },

  emptyText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },

  emptySub: {
    color: '#888',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 22,
  },

  deviceCard: {
    backgroundColor: '#1a1a3e',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2a2a5e',
  },

  deviceName: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 4,
  },

  deviceId: {
    color: '#888',
    fontSize: 11,
  },

  payBadge: {
    backgroundColor: '#6366f1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },

  payBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },

  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },

  overlayText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },

  overlaySubtext: {
    color: '#888',
    fontSize: 14,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },

  modalCard: {
    backgroundColor: '#1a1a3e',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 32,
    borderWidth: 1,
    borderColor: '#2a2a5e',
  },

  modalTitle: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },

  modalDevice: {
    color: '#888',
    fontSize: 14,
    marginBottom: 24,
  },

  modalLabel: {
    color: '#aaa',
    fontSize: 13,
    marginBottom: 8,
  },

  modalInput: {
    backgroundColor: '#0f0f23',
    borderRadius: 14,
    padding: 20,
    color: 'white',
    fontSize: 32,
    fontWeight: 'bold',
    borderWidth: 1,
    borderColor: '#2a2a5e',
    textAlign: 'center',
    marginBottom: 16,
  },

  modalPayBtn: {
    backgroundColor: '#6366f1',
    borderRadius: 14,
    padding: 18,
    alignItems: 'center',
    marginBottom: 12,
  },

  modalPayBtnText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },

  modalCancelBtn: {
    padding: 16,
    alignItems: 'center',
  },

  modalCancelText: {
    color: '#888',
    fontSize: 15,
  },
});

export default styles;