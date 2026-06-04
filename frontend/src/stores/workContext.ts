import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import {
  listProjects,
  listVolumes,
  createProject,
  createVolume,
  deleteProject,
  updateProject,
  type Project,
  type ProjectUpsert,
  type Volume,
  type VolumeUpsert
} from '@/api/modules/projects'

const PROJECT_KEY = 'tm.workContext.projectId'
const VOLUME_KEY = 'tm.workContext.volumeId'

export const useWorkContextStore = defineStore('workContext', () => {
  const projects = ref<Project[]>([])
  const volumes = ref<Volume[]>([])
  const selectedProjectId = ref('')
  const selectedVolumeId = ref('')
  const loadingProjects = ref(false)
  const loadingVolumes = ref(false)

  const selectedProject = computed(() =>
    projects.value.find((p) => p.id === selectedProjectId.value) ?? null
  )
  const selectedVolume = computed(() =>
    volumes.value.find((v) => v.id === selectedVolumeId.value) ?? null
  )

  async function init() {
    if (selectedProjectId.value) return
    selectedProjectId.value = localStorage.getItem(PROJECT_KEY) ?? ''
    selectedVolumeId.value = localStorage.getItem(VOLUME_KEY) ?? ''
    await refreshProjects()
  }

  async function refreshProjects() {
    loadingProjects.value = true
    try {
      projects.value = await listProjects()
      if (!projects.value.some((p) => p.id === selectedProjectId.value)) {
        selectedProjectId.value = projects.value[0]?.id ?? ''
      }
      await refreshVolumes()
    } finally {
      loadingProjects.value = false
    }
  }

  async function refreshVolumes() {
    if (!selectedProjectId.value) {
      volumes.value = []
      selectedVolumeId.value = ''
      return
    }

    loadingVolumes.value = true
    try {
      volumes.value = await listVolumes(selectedProjectId.value)
      if (!volumes.value.some((v) => v.id === selectedVolumeId.value)) {
        selectedVolumeId.value = volumes.value[0]?.id ?? ''
      }
    } finally {
      loadingVolumes.value = false
    }
  }

  async function addProject(input: ProjectUpsert) {
    const project = await createProject(input)
    projects.value = [project, ...projects.value.filter((p) => p.id !== project.id)]
    selectedProjectId.value = project.id
    await refreshVolumes()
    return project
  }

  async function removeProject(id: string) {
    await deleteProject(id)
    projects.value = projects.value.filter((p) => p.id !== id)
    if (selectedProjectId.value === id) {
      selectedProjectId.value = projects.value[0]?.id ?? ''
    }
    await refreshVolumes()
  }

  async function addVolume(input: Omit<VolumeUpsert, 'projectId'>) {
    if (!selectedProjectId.value) throw new Error('请先选择项目')
    const volume = await createVolume({ ...input, projectId: selectedProjectId.value })
    volumes.value = [...volumes.value.filter((v) => v.id !== volume.id), volume]
      .sort((a, b) => a.volumeNumber - b.volumeNumber)
    selectedVolumeId.value = volume.id
    return volume
  }

  async function updateSelectedProjectSourceBook(sourceBookId: string | null) {
    const project = selectedProject.value
    if (!project) throw new Error('请先选择项目')

    const updated = await updateProject(project.id, {
      name: project.name,
      description: project.description,
      currentSourceBookId: sourceBookId
    })
    projects.value = projects.value.map((p) => p.id === updated.id ? updated : p)
    return updated
  }

  watch(selectedProjectId, async (id) => {
    localStorage.setItem(PROJECT_KEY, id)
    await refreshVolumes()
  })

  watch(selectedVolumeId, (id) => {
    localStorage.setItem(VOLUME_KEY, id)
  })

  return {
    projects,
    volumes,
    selectedProjectId,
    selectedVolumeId,
    selectedProject,
    selectedVolume,
    loadingProjects,
    loadingVolumes,
    init,
    refreshProjects,
    refreshVolumes,
    addProject,
    removeProject,
    addVolume,
    updateSelectedProjectSourceBook
  }
})
