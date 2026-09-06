// Small, single-plane flash geometry for the beginner presets - deliberately
// shrunk from the "realistic" 512GB config (engine/mqsim/ssdconfig.xml: 8
// channels x 4 chips x 2 dies x 2 planes x 2048 blocks) down to one single
// plane, so the flash grid can show every block on screen at once. Same
// real MQSim logic, just simulating a smaller SSD.
//
// Session 9: the knobs the plan calls "page 크기, block/page 개수, OP 비율,
// GC 임계값, 매핑 방식" are now parameterized here instead of hardcoded, so
// ParamPanel.tsx can regenerate this text and reconfigure() the engine.
export interface SsdParams {
  pageCapacityBytes: 4096 | 8192 | 16384;
  blockNoPerPlane: number;
  pageNoPerBlock: number;
  overprovisioningRatio: number; // 0..1
  gcExecThreshold: number; // 0..1
  // 'HYBRID' is intentionally not a real option here - MQSim's Hybrid
  // Address_Mapping_Unit is an empty stub nothing constructs (see the
  // comment on Get_mapping_table_snapshot() in MQSim_Interface.cpp) -
  // sending it to configure() would break the engine. ParamPanel.tsx shows
  // it as a visible-but-disabled choice, matching the plan's UI, but only
  // PAGE_LEVEL is ever actually generated here.
  addressMapping: 'PAGE_LEVEL';
}

export const DEFAULT_MAPPING_PARAMS: SsdParams = {
  pageCapacityBytes: 8192,
  blockNoPerPlane: 32,
  pageNoPerBlock: 16,
  overprovisioningRatio: 0.07,
  gcExecThreshold: 0.05,
  addressMapping: 'PAGE_LEVEL',
};

export function buildSsdConfigXml(params: SsdParams): string {
  return `<?xml version="1.0" encoding="us-ascii"?>
<Execution_Parameter_Set>
	<Host_Parameter_Set>
		<PCIe_Lane_Bandwidth>1.00000</PCIe_Lane_Bandwidth>
		<PCIe_Lane_Count>4</PCIe_Lane_Count>
		<SATA_Processing_Delay>400000</SATA_Processing_Delay>
		<Enable_ResponseTime_Logging>false</Enable_ResponseTime_Logging>
		<ResponseTime_Logging_Period_Length>1000000</ResponseTime_Logging_Period_Length>
	</Host_Parameter_Set>
	<Device_Parameter_Set>
		<Seed>321</Seed>
		<Enabled_Preconditioning>false</Enabled_Preconditioning>
		<Memory_Type>FLASH</Memory_Type>
		<HostInterface_Type>NVME</HostInterface_Type>
		<IO_Queue_Depth>65535</IO_Queue_Depth>
		<Queue_Fetch_Size>512</Queue_Fetch_Size>
		<Caching_Mechanism>ADVANCED</Caching_Mechanism>
		<Data_Cache_Sharing_Mode>SHARED</Data_Cache_Sharing_Mode>
		<Data_Cache_Capacity>268435456</Data_Cache_Capacity>
		<Data_Cache_DRAM_Row_Size>8192</Data_Cache_DRAM_Row_Size>
		<Data_Cache_DRAM_Data_Rate>100</Data_Cache_DRAM_Data_Rate>
		<Data_Cache_DRAM_Data_Busrt_Size>1</Data_Cache_DRAM_Data_Busrt_Size>
		<Data_Cache_DRAM_tRCD>13</Data_Cache_DRAM_tRCD>
		<Data_Cache_DRAM_tCL>13</Data_Cache_DRAM_tCL>
		<Data_Cache_DRAM_tRP>13</Data_Cache_DRAM_tRP>
		<Address_Mapping>${params.addressMapping}</Address_Mapping>
		<Ideal_Mapping_Table>false</Ideal_Mapping_Table>
		<CMT_Capacity>2097152</CMT_Capacity>
		<CMT_Sharing_Mode>SHARED</CMT_Sharing_Mode>
		<Plane_Allocation_Scheme>CWDP</Plane_Allocation_Scheme>
		<Transaction_Scheduling_Policy>PRIORITY_OUT_OF_ORDER</Transaction_Scheduling_Policy>
		<Overprovisioning_Ratio>${params.overprovisioningRatio.toFixed(5)}</Overprovisioning_Ratio>
		<GC_Exec_Threshold>${params.gcExecThreshold.toFixed(5)}</GC_Exec_Threshold>
		<GC_Block_Selection_Policy>RGA</GC_Block_Selection_Policy>
		<Use_Copyback_for_GC>false</Use_Copyback_for_GC>
		<Preemptible_GC_Enabled>false</Preemptible_GC_Enabled>
		<GC_Hard_Threshold>0.005000</GC_Hard_Threshold>
		<Dynamic_Wearleveling_Enabled>true</Dynamic_Wearleveling_Enabled>
		<Static_Wearleveling_Enabled>true</Static_Wearleveling_Enabled>
		<Static_Wearleveling_Threshold>100</Static_Wearleveling_Threshold>
		<Preferred_suspend_erase_time_for_read>700000</Preferred_suspend_erase_time_for_read>
		<Preferred_suspend_erase_time_for_write>700000</Preferred_suspend_erase_time_for_write>
		<Preferred_suspend_write_time_for_read>100000</Preferred_suspend_write_time_for_read>
		<Flash_Channel_Count>1</Flash_Channel_Count>
		<Flash_Channel_Width>1</Flash_Channel_Width>
		<Channel_Transfer_Rate>333</Channel_Transfer_Rate>
		<Chip_No_Per_Channel>1</Chip_No_Per_Channel>
		<Flash_Comm_Protocol>NVDDR2</Flash_Comm_Protocol>
		<Flash_Parameter_Set>
			<Flash_Technology>MLC</Flash_Technology>
			<CMD_Suspension_Support>ERASE</CMD_Suspension_Support>
			<Page_Read_Latency_LSB>75000</Page_Read_Latency_LSB>
			<Page_Read_Latency_CSB>75000</Page_Read_Latency_CSB>
			<Page_Read_Latency_MSB>75000</Page_Read_Latency_MSB>
			<Page_Program_Latency_LSB>750000</Page_Program_Latency_LSB>
			<Page_Program_Latency_CSB>750000</Page_Program_Latency_CSB>
			<Page_Program_Latency_MSB>750000</Page_Program_Latency_MSB>
			<Block_Erase_Latency>3800000</Block_Erase_Latency>
			<Block_PE_Cycles_Limit>10000</Block_PE_Cycles_Limit>
			<Suspend_Erase_Time>700000</Suspend_Erase_Time>
			<Suspend_Program_Time>100000</Suspend_Program_Time>
			<Die_No_Per_Chip>1</Die_No_Per_Chip>
			<Plane_No_Per_Die>1</Plane_No_Per_Die>
			<Block_No_Per_Plane>${params.blockNoPerPlane}</Block_No_Per_Plane>
			<Page_No_Per_Block>${params.pageNoPerBlock}</Page_No_Per_Block>
			<Page_Capacity>${params.pageCapacityBytes}</Page_Capacity>
			<Page_Metadat_Capacity>448</Page_Metadat_Capacity>
		</Flash_Parameter_Set>
	</Device_Parameter_Set>
</Execution_Parameter_Set>
`;
}

// One small synthetic write-heavy flow - enough requests to populate the
// mapping table visibly within a couple of steps, small enough to run
// instantly. Stop_Time/Total_Requests_To_Generate both bound it (belt and
// suspenders - during testing only Stop_Time reliably capped a QUEUE_DEPTH
// generator, but both are set here in case that varies by config).
// Address_Alignment_Unit tracks pageNoPerBlock so a write still lands on
// exactly one page regardless of the chosen block/page geometry.
export function buildMappingWorkloadXml(params: SsdParams): string {
  return `<?xml version="1.0" encoding="us-ascii"?>
<MQSim_IO_Scenarios>
	<IO_Scenario>
		<IO_Flow_Parameter_Set_Synthetic>
			<Priority_Class>HIGH</Priority_Class>
			<Device_Level_Data_Caching_Mode>WRITE_CACHE</Device_Level_Data_Caching_Mode>
			<Channel_IDs>0</Channel_IDs>
			<Chip_IDs>0</Chip_IDs>
			<Die_IDs>0</Die_IDs>
			<Plane_IDs>0</Plane_IDs>
			<Initial_Occupancy_Percentage>0</Initial_Occupancy_Percentage>
			<Working_Set_Percentage>100</Working_Set_Percentage>
			<Synthetic_Generator_Type>QUEUE_DEPTH</Synthetic_Generator_Type>
			<Read_Percentage>0</Read_Percentage>
			<Address_Distribution>RANDOM_UNIFORM</Address_Distribution>
			<Percentage_of_Hot_Region>0</Percentage_of_Hot_Region>
			<Generated_Aligned_Addresses>true</Generated_Aligned_Addresses>
			<Address_Alignment_Unit>${params.pageNoPerBlock}</Address_Alignment_Unit>
			<Request_Size_Distribution>FIXED</Request_Size_Distribution>
			<Average_Request_Size>8</Average_Request_Size>
			<Variance_Request_Size>0</Variance_Request_Size>
			<Seed>798</Seed>
			<Average_No_of_Reqs_in_Queue>4</Average_No_of_Reqs_in_Queue>
			<Intensity>32768</Intensity>
			<Stop_Time>500000</Stop_Time>
			<Total_Requests_To_Generate>200</Total_Requests_To_Generate>
		</IO_Flow_Parameter_Set_Synthetic>
	</IO_Scenario>
</MQSim_IO_Scenarios>
`;
}

// Backwards-compatible fixed exports for any code that hasn't moved to the
// parameterized builders yet.
export const mappingBasicSsdConfigXml = buildSsdConfigXml(DEFAULT_MAPPING_PARAMS);
export const mappingBasicWorkloadXml = buildMappingWorkloadXml(DEFAULT_MAPPING_PARAMS);

// "GC 시연" preset - same small geometry, but a much higher GC_Exec_Threshold
// (block_pool_gc_threshold = floor(gcExecThreshold * blockNoPerPlane) - the
// default 0.05 needs the pool down to its last 1-2 blocks before GC ever
// looks at firing, unreachable in a demo-sized run).
export const DEFAULT_GC_PARAMS: SsdParams = {
  ...DEFAULT_MAPPING_PARAMS,
  gcExecThreshold: 0.5,
};

// Same synthetic write flow as buildMappingWorkloadXml, but tuned to
// actually trigger GC live rather than just fill the mapping table:
// - Working_Set_Percentage narrowed to 25% of the address space, so
//   RANDOM_UNIFORM writes collide (overwrite the same LPA) often enough to
//   produce invalid pages - GC_and_WL_Unit_Page_Level::Check_gc_required()
//   silently no-ops if its randomly-sampled candidate block has zero
//   invalid pages to reclaim, which is what happens at the default 100%
//   working set (writes almost never repeat an address, so there's
//   nothing for GC to usefully collect even once the free-block threshold
//   is crossed). See the reconfigure-crash-bug writeup's companion
//   investigation for how this was found.
// - Stop_Time raised enough to let ~10 GC executions happen (measured via
//   a native-CLI step-count harness: this config takes ~850k event-groups
//   to reach Stop_Time, hence the much higher default playback speed
//   App.tsx uses for this preset - see useSimulationPlayback's
//   ticksMultiplier).
export function buildGcWorkloadXml(params: SsdParams): string {
  return `<?xml version="1.0" encoding="us-ascii"?>
<MQSim_IO_Scenarios>
	<IO_Scenario>
		<IO_Flow_Parameter_Set_Synthetic>
			<Priority_Class>HIGH</Priority_Class>
			<Device_Level_Data_Caching_Mode>WRITE_CACHE</Device_Level_Data_Caching_Mode>
			<Channel_IDs>0</Channel_IDs>
			<Chip_IDs>0</Chip_IDs>
			<Die_IDs>0</Die_IDs>
			<Plane_IDs>0</Plane_IDs>
			<Initial_Occupancy_Percentage>0</Initial_Occupancy_Percentage>
			<Working_Set_Percentage>25</Working_Set_Percentage>
			<Synthetic_Generator_Type>QUEUE_DEPTH</Synthetic_Generator_Type>
			<Read_Percentage>0</Read_Percentage>
			<Address_Distribution>RANDOM_UNIFORM</Address_Distribution>
			<Percentage_of_Hot_Region>0</Percentage_of_Hot_Region>
			<Generated_Aligned_Addresses>true</Generated_Aligned_Addresses>
			<Address_Alignment_Unit>${params.pageNoPerBlock}</Address_Alignment_Unit>
			<Request_Size_Distribution>FIXED</Request_Size_Distribution>
			<Average_Request_Size>8</Average_Request_Size>
			<Variance_Request_Size>0</Variance_Request_Size>
			<Seed>798</Seed>
			<Average_No_of_Reqs_in_Queue>4</Average_No_of_Reqs_in_Queue>
			<Intensity>32768</Intensity>
			<Stop_Time>2500000000</Stop_Time>
			<Total_Requests_To_Generate>1000000</Total_Requests_To_Generate>
		</IO_Flow_Parameter_Set_Synthetic>
	</IO_Scenario>
</MQSim_IO_Scenarios>
`;
}
