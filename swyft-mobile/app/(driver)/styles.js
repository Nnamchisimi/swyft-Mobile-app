import { StyleSheet } from 'react-native';
import { COLORS } from '../../src/constants/config';

export default StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    flexGrow: 1,
  },
  scrollContentContainer: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
 mapContainer:{
    height:340,
    marginHorizontal:18,
    marginTop:16,
    borderRadius:30,
    overflow:'hidden',
    elevation:10,
    shadowOpacity:0.16,
    shadowRadius:18,
},
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
  },
  mapPlaceholderText: {
    marginTop: 10,
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  driverMarkerStyle:{
    width:52,
    height:52,
    borderRadius:26,
    backgroundColor:COLORS.primary,
    justifyContent:'center',
    alignItems:'center',
    borderWidth:4,
    borderColor:"#FFF",
    elevation:10,
},
  driverMarkerText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  },
header: { flexDirection: 'row',
   justifyContent: 'space-between',
    alignItems: 'center', 
    paddingHorizontal: 16, 
    paddingVertical: 14,
     backgroundColor: COLORS.white, 
     borderBottomWidth: 1,
      borderBottomColor: COLORS.border, 
    
    },
  headerLeft: {
    flex: 1,
  },
  brandName:{
    fontSize:12,
    letterSpacing:3,
    fontWeight:'900',
    color:COLORS.primary,
},
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.text,
  },
headerSubtitle:{
    fontSize:15,
    color:'#6B7280',
    marginTop:5,
},
  vehicleInfoContainer: {
    marginTop: 8,
    padding: 8,
    backgroundColor: COLORS.surface,
    borderRadius: 8,
  },
  vehicleInfoTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 4,
  },
  vehicleInfo: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 2,
  },
  profileButton: {
    padding: 4,
  },
 profileAvatar:{
    width:52,
    height:52,
    borderRadius:26,
    backgroundColor:COLORS.primary,

    justifyContent:'center',
    alignItems:'center',

    elevation:6,

    shadowColor:"#000",
    shadowOpacity:0.18,
    shadowRadius:8,
},
  profileAvatarText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.white,
  },
statusCard:{
    marginTop:18,

    marginHorizontal:18,

    borderRadius:26,

    padding:22,

    backgroundColor:"#FFF",

    elevation:8,

    shadowColor:"#000",

    shadowOpacity:0.08,

    shadowRadius:16,

    shadowOffset:{
        width:0,
        height:6,
    },
},
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusInfo: {
    flex: 1,
  },
  statusLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    fontWeight: '700',
    letterSpacing: 1,
  },
 statusValue:{
    fontSize:24,
    fontWeight:'800',
},
  onlineText: {
    color: COLORS.success,
  },
  offlineText: {
    color: COLORS.textSecondary,
  },
  toggleButton: {
    backgroundColor: COLORS.success,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    shadowColor: COLORS.success,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  toggleButtonActive: {
    backgroundColor: COLORS.error,
  },
  toggleText: {
    color: COLORS.white,
    fontWeight: '600',
    fontSize: 14,
  },
  toggleTextActive: {
    color: COLORS.white,
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  locationIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  locationCoords: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  availableSection: {
    flex: 1,
    paddingHorizontal: 16,
    marginTop: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
 sectionTitle:{
    fontSize:22,

    fontWeight:'800',

    color:"#111827",
},
rideCount:{
    backgroundColor:"#EEF4FF",
    color:COLORS.primary,
    paddingHorizontal:12,
    paddingVertical:6,
    borderRadius:20,
    fontWeight:'700',
},
  ridesList: {
    flex: 1,
  },
  ridesListContent: {
    paddingBottom: 20,
  },
  rideCard:{
    backgroundColor:"#FFF",
    borderRadius:26,
    padding:22,
    marginBottom:20,
    elevation:8,
    shadowColor:"#000",
    shadowOpacity:0.08,
    shadowRadius:14,
    shadowOffset:{
        width:0,
        height:5,
    },

    borderLeftWidth:0,
},
  rideCardUrgent: {
    borderLeftColor: COLORS.error,
    backgroundColor: '#fff5f5',
  },
  rideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  rideIdBadge: {
    backgroundColor: COLORS.surface,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  rideIdText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
ridePrice:{
    fontSize:28,
    fontWeight:'900',
    color:"#16A34A",
},
  rideLocations: {
    marginBottom: 16,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  locationDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 4,
    marginRight: 12,
  },
  locationConnector: {
    width: 2,
    height: 24,
    backgroundColor: COLORS.border,
    marginLeft: 5,
  },
  locationTextContainer: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginBottom: 2,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  locationText: {
    fontSize: 14,
    color: COLORS.text,
  },
  ridePassenger: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 14,
    gap: 12,
  },
  passengerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  passengerAvatarText: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
  passengerInfo: {
    flex: 1,
  },
  passengerName: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 2,
  },
  passengerPhone: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  vehicleTypeBadge: {
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: '600',
    marginTop: 2,
  },
  rideTypeBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.white,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
  },
  rideTypeText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.white,
  },
  rideActions: {
    flexDirection: 'row',
    gap: 12,
  },
  declineButton:{
    flex:1,
    height:56,
    borderRadius:18,
    justifyContent:'center',
    alignItems:'center',
    backgroundColor:"#F3F4F6",
},
  declineButtonText: {
    color: COLORS.textSecondary,
    fontWeight: '600',
    fontSize: 14,
  },
acceptButton:{
    flex:1,
    height:56,
    borderRadius:18,
    justifyContent:'center',
    alignItems:'center',
    backgroundColor:"#16A34A",
    elevation:5,
},
  acceptButtonText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 14,
  },
  currentRideCard: {
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 12,
    padding: 20,
    backgroundColor: COLORS.white,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  currentRideHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  currentRideTitle:{
    fontSize:24,
    fontWeight:'800',
},
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  statusText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '600',
  },
  etaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  etaLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  etaText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.success,
  },
  passengerContact: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginTop: 8,
  },
  ridePriceLarge: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.success,
  },
  currentRideActions: {
    marginTop: 16,
    gap: 12,
  },
  arrivedButton: {
    backgroundColor: COLORS.secondary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  arrivedButtonText: {
    color: COLORS.white,
    fontWeight: '600',
    fontSize: 16,
  },
  startButton: {
    backgroundColor: COLORS.success,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  startButtonText: {
    color: COLORS.white,
    fontWeight: '600',
    fontSize: 16,
  },
  completeButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  completeButtonText: {
    color: COLORS.white,
    fontWeight: '600',
    fontSize: 16,
  },
 navigationButton:{
    height:58,
   borderRadius:18,
    backgroundColor:COLORS.primary,
    justifyContent:'center',
    alignItems:'center',
    flexDirection:'row',
    elevation:5,
},
  navigationButtonText: {
    color: COLORS.white,
    fontWeight: '600',
    fontSize: 16,
  },
  cancelRideButton: {
    backgroundColor: COLORS.surface,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelRideButtonText: {
    color: COLORS.error,
    fontWeight: '500',
    fontSize: 14,
  },
  waitingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    marginBottom: 8,
  },
  waitingText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginLeft: 8,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
 emptyIcon:{
    fontSize:90,
},
emptyTitle:{
    fontSize:24,
    fontWeight:'800',
},

emptyText:{
    fontSize:15,
    color:"#6B7280",
    textAlign:'center',
    marginTop:8,
    lineHeight:22,
},
  refreshButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  refreshButtonText: {
    color: COLORS.white,
    fontWeight: '600',
  },
  offlineContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  offlineIcon: {
    fontSize: 80,
    marginBottom: 20,
  },
  offlineTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 12,
  },
  offlineMessage: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  goOnlineButton: {
    backgroundColor: COLORS.success,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 25,
  },
  goOnlineButtonText: {
    color: COLORS.white,
    fontWeight: '600',
    fontSize: 16,
  },
  bottomStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    paddingHorizontal: 12,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginTop: 8,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  statLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: COLORS.border,
  },
  packageInfo: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
  },
  packageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  packageHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
    marginLeft: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  packageDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  packageItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  packageLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginRight: 4,
  },
  packageValue: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.text,
  },
  packageSpecial: {
    color: COLORS.error,
  },
  packageInfoCurrent: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.primary,
  },
  packageDetailsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  packageChip: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  packageChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: COLORS.text,
  },
  packageChipSpecial: {
    backgroundColor: '#FFF5F5',
    borderColor: COLORS.error,
  },
  packageChipTextSpecial: {
    color: COLORS.error,
  },
});
