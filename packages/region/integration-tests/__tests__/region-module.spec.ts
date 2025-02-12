import { Modules } from "@medusajs/modules-sdk"
import { IRegionModuleService } from "@medusajs/types"
import { initModules } from "medusa-test-utils"
import { MikroOrmWrapper } from "../utils"
import { getInitModuleConfig } from "../utils/get-init-module-config"

jest.setTimeout(30000)

describe("Region Module Service", () => {
  let service: IRegionModuleService
  let shutdownFunc: () => Promise<void>

  beforeEach(async () => {
    await MikroOrmWrapper.setupDatabase()

    const initModulesConfig = getInitModuleConfig()
    const { medusaApp, shutdown } = await initModules(initModulesConfig)
    service = medusaApp.modules[Modules.REGION]

    shutdownFunc = shutdown
  })

  afterEach(async () => {
    await MikroOrmWrapper.clearDatabase()
    await shutdownFunc()
  })

  it("should create countries on application start", async () => {
    const countries = await service.listCountries({}, { take: null })
    expect(countries.length).toEqual(250)
  })

  it("should create and list a region", async () => {
    const createdRegion = await service.create({
      name: "Europe",
      currency_code: "EUR",
    })

    expect(createdRegion).toEqual(
      expect.objectContaining({
        id: createdRegion.id,
        name: "Europe",
        currency_code: "eur",
        countries: [],
      })
    )

    const region = await service.retrieve(createdRegion.id, {
      relations: ["countries"],
    })

    expect(region).toEqual(
      expect.objectContaining({
        id: region.id,
        name: "Europe",
        currency_code: "eur",
        countries: [],
      })
    )
  })

  it("should create a region with countries", async () => {
    const createdRegion = await service.create({
      name: "North America",
      currency_code: "USD",
      countries: ["us", "ca"],
    })

    const region = await service.retrieve(createdRegion.id, {
      relations: ["countries"],
    })

    expect(region).toEqual(
      expect.objectContaining({
        id: region.id,
        name: "North America",
        currency_code: "usd",
        countries: [
          expect.objectContaining({
            display_name: "Canada",
            iso_2: "ca",
          }),
          expect.objectContaining({
            display_name: "United States",
            iso_2: "us",
          }),
        ],
      })
    )
  })

  it("should throw when country doesn't exist", async () => {
    await expect(
      service.create({
        name: "North America",
        currency_code: "USD",
        countries: ["neverland"],
      })
    ).rejects.toThrowError('Countries with codes: "neverland" do not exist')
  })

  it("should throw when country is already assigned to a region", async () => {
    await service.create({
      name: "North America",
      currency_code: "USD",
      countries: ["us"],
    })

    await expect(
      service.create({
        name: "United States",
        currency_code: "USD",
        countries: ["us"],
      })
    ).rejects.toThrowError(
      'Countries with codes: "us" are already assigned to a region'
    )
  })

  it("should throw when country is being assigned to multiple regions", async () => {
    await expect(
      service.create([
        {
          name: "United States",
          currency_code: "USD",
          countries: ["us"],
        },
        {
          name: "North America",
          currency_code: "USD",
          countries: ["us"],
        },
      ])
    ).rejects.toThrowError(
      'Countries with codes: "us" are already assigned to a region'
    )
  })

  it("should upsert the region successfully", async () => {
    const createdRegion = await service.upsert({
      name: "North America",
      currency_code: "USD",
      countries: ["us", "ca"],
    })

    await service.upsert({
      id: createdRegion.id,
      name: "Americas",
      currency_code: "MXN",
      countries: ["us", "mx"],
    })

    const latestRegion = await service.retrieve(createdRegion.id, {
      relations: ["countries"],
    })

    expect(latestRegion).toMatchObject({
      id: createdRegion.id,
      name: "Americas",
      currency_code: "mxn",
    })
    expect(latestRegion.countries.map((c) => c.iso_2)).toEqual(["mx", "us"])
  })

  it("should allow mixing create and update operations in upsert", async () => {
    const createdRegion = await service.upsert({
      name: "North America",
      currency_code: "USD",
      countries: ["us", "ca"],
    })

    const upserted = await service.upsert([
      {
        id: createdRegion.id,
        name: "Americas",
        currency_code: "USD",
        countries: ["us", "ca"],
      },
      {
        name: "Central America",
        currency_code: "MXN",
        countries: ["mx"],
      },
    ])

    expect(upserted).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: createdRegion.id,
          name: "Americas",
          currency_code: "usd",
        }),
        expect.objectContaining({
          name: "Central America",
          currency_code: "mxn",
        }),
      ])
    )
  })

  it("should update the region successfully", async () => {
    const createdRegion = await service.create({
      name: "North America",
      currency_code: "USD",
      countries: ["us", "ca"],
    })

    await service.update(createdRegion.id, {
      name: "Americas",
      currency_code: "MXN",
      countries: ["us", "mx"],
    })

    const latestRegion = await service.retrieve(createdRegion.id, {
      relations: ["countries"],
    })

    expect(latestRegion).toMatchObject({
      id: createdRegion.id,
      name: "Americas",
      currency_code: "mxn",
    })

    expect(latestRegion.countries.map((c) => c.iso_2)).toEqual(["mx", "us"])
  })

  it("should update the region without affecting countries if countries are undefined", async () => {
    const createdRegion = await service.create({
      name: "North America",
      currency_code: "USD",
      countries: ["us", "ca"],
    })

    await service.update(createdRegion.id, {
      name: "Americas",
      currency_code: "MXN",
    })

    const updatedRegion = await service.retrieve(createdRegion.id, {
      relations: ["countries"],
    })

    expect(updatedRegion).toMatchObject({
      id: createdRegion.id,
      name: "Americas",
      currency_code: "mxn",
    })

    expect(updatedRegion.countries.map((c) => c.iso_2)).toEqual(["ca", "us"])
  })

  it("should remove the countries in a region successfully", async () => {
    const createdRegion = await service.create({
      name: "North America",
      currency_code: "USD",
      countries: ["us", "ca"],
    })

    await service.update(createdRegion.id, {
      name: "Americas",
      currency_code: "MXN",
      countries: [],
    })

    const updatedRegion = await service.retrieve(createdRegion.id, {
      relations: ["countries"],
    })

    expect(updatedRegion).toMatchObject({
      id: createdRegion.id,
      name: "Americas",
      currency_code: "mxn",
    })

    expect(updatedRegion.countries).toHaveLength(0)
  })

  it("should fail updating the region countries to non-existent ones", async () => {
    const createdRegion = await service.create({
      name: "North America",
      currency_code: "USD",
      countries: ["us", "ca"],
    })

    await expect(
      service.update(
        { id: createdRegion.id },
        {
          countries: ["us", "neverland"],
        }
      )
    ).rejects.toThrowError('Countries with codes: "neverland" do not exist')
  })

  it("should fail updating the region if there are duplicate countries", async () => {
    const createdRegion = await service.create({
      name: "North America",
      currency_code: "USD",
      countries: ["us", "ca"],
    })

    await expect(
      service.update(
        { id: createdRegion.id },
        {
          countries: ["us", "us"],
        }
      )
    ).rejects.toThrowError(
      'Countries with codes: "us" are already assigned to a region'
    )
  })

  it("should fail updating the region if country is already used", async () => {
    const [createdRegion] = await service.create([
      {
        name: "North America",
        currency_code: "USD",
        countries: ["us", "ca"],
      },
      {
        name: "Americas",
        currency_code: "USD",
        countries: ["mx"],
      },
    ])

    await expect(
      service.update(
        { id: createdRegion.id },
        {
          countries: ["us", "mx"],
        }
      )
    ).rejects.toThrowError(
      'Countries with codes: "mx" are already assigned to a region'
    )
  })

  it("should unset the region ID on the country when deleting a region", async () => {
    const createdRegion = await service.create({
      name: "North America",
      currency_code: "USD",
      countries: ["us", "ca"],
    })

    await service.delete(createdRegion.id)

    const resp = await service.create({
      name: "North America",
      currency_code: "USD",
      countries: ["us", "ca"],
    })

    expect(resp.countries).toHaveLength(2)
  })
})
